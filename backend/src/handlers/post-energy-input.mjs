import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  TimestreamWriteClient,
  WriteRecordsCommand,
} from "@aws-sdk/client-timestream-write";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import moment from "moment";

//DynamoDB Endpoint
const ENDPOINT_OVERRIDE = process.env.ENDPOINT_OVERRIDE;
let ddbClient = undefined;

if (ENDPOINT_OVERRIDE) {
  ddbClient = new DynamoDBClient({ endpoint: ENDPOINT_OVERRIDE });
} else {
  ddbClient = new DynamoDBClient({}); // Use default values for DynamoDB endpoint
  console.warn(
    "No value for ENDPOINT_OVERRIDE provided for DynamoDB, using default"
  );
}

const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

// Timestream client
const timestreamClient = new TimestreamWriteClient({});

// SNS client
const snsClient = new SNSClient({});

// Get the SNS topic ARN from environment variables
const snsTopicArn = process.env.SNS_TOPIC_ARN;

// Get the Timestream database and table name from environment variables
const timestreamDatabaseName = process.env.TIMESTREAM_DATABASE_NAME;
const timestreamTableName = process.env.TIMESTREAM_TABLE_NAME;

console.info("Using Timestream database: ", timestreamDatabaseName);
console.info("Using Timestream table: ", timestreamTableName);

// Get the DynamoDB table name from environment variables
const tableName = process.env.TABLE;
console.info("Using DynamoDB table: ", tableName);

// Function for validation of date format
function isValidDate(dateString, format) {
  return moment(dateString, format, true).isValid();
}

/**
 * A HTTP POST method to add energy input data to a Timestream table.
 */
export const postEnergyInputHandler = async (event) => {
  if (event.httpMethod !== "POST") {
    throw new Error(
      `postEnergyInputHandler only accepts POST method, you tried: ${event.httpMethod} method.`
    );
  }
  // All log statements are written to CloudWatch
  console.info("received:", event);

  // Get data from the body of the request
  const body = JSON.parse(event.body);

  // Ensure the required fields are present in the request body
  if (!body.date || !body.usage) {
    throw new Error("Missing required fields in the request body");
  }

  // Validate the date format
  if (!isValidDate(body.date, "YYYY-MM-DD")) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  // Extract the Cognito sub from the authorizer claims to use as ID
  const cognitoSub = event.requestContext.authorizer?.claims?.sub;

  // Check if the user has a threshold set and compare with current usage
  try {
    // Get the user's threshold from DynamoDB
    const getUserParams = {
      TableName: tableName,
      Key: { id: cognitoSub },
      ProjectionExpression: "threshold",
    };

    const userResult = await ddbDocClient.send(new GetCommand(getUserParams));
    console.log("User data retrieved:", userResult);

    // If the user has a threshold set and the current usage exceeds it, send an SNS notification
    if (
      userResult.Item &&
      userResult.Item.threshold &&
      parseFloat(body.usage) > parseFloat(userResult.Item.threshold)
    ) {
      console.log("Energy usage exceeds threshold, sending notification");

      // Create the SNS message
      const message = {
        userId: cognitoSub,
        date: body.date,
        usage: body.usage,
        threshold: userResult.Item.threshold,
        message: `Energy usage alert: Your energy usage of ${body.usage} kWh on ${body.date} exceeds your threshold of ${userResult.Item.threshold} kWh.`,
      };

      // Publish the message to SNS
      const snsParams = {
        TopicArn: snsTopicArn,
        Message: JSON.stringify(message),
        Subject: "Energy Usage Threshold Exceeded",
      };

      await snsClient.send(new PublishCommand(snsParams));
      console.log("SNS notification sent successfully");
    } else {
      console.log("Energy usage is within threshold or no threshold set");
    }
  } catch (thresholdErr) {
    console.error(
      "Error checking threshold or sending notification:",
      thresholdErr
    );
    // Don't fail the request if threshold check fails
  }

  // Prepare and write data to Timestream
  try {
    // Current time in milliseconds
    const currentTime = Date.now();

    // Prepare the Timestream records
    const records = [
      {
        Dimensions: [
          {
            Name: "id",
            Value: cognitoSub,
          },
          {
            Name: "date",
            Value: body.date,
          },
        ],
        MeasureName: "energy_usage",
        MeasureValue: body.usage.toString(),
        MeasureValueType: "DOUBLE",
        Time: currentTime.toString(),
      },
    ];

    // Create the Timestream write command
    const timestreamParams = {
      DatabaseName: timestreamDatabaseName,
      TableName: timestreamTableName,
      Records: records,
    };

    // Write to Timestream
    await timestreamClient.send(new WriteRecordsCommand(timestreamParams));
    console.log("Success - energy usage data added to Timestream");
  } catch (timestreamErr) {
    console.error(
      "Error adding energy usage data to Timestream:",
      timestreamErr.message
    );
    console.error("Error code:", timestreamErr.code);
    console.error("Error name:", timestreamErr.name);
    console.error("Error stack:", timestreamErr.stack);
    throw timestreamErr;
  }

  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Origin": "*", //DO NOT USE THIS VALUE IN PRODUCTION - https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    },
    body: JSON.stringify({
      id: cognitoSub,
      ...body,
      message: "Energy data saved successfully",
    }),
  };

  // All log statements are written to CloudWatch
  console.info(
    `response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`
  );
  return response;
};
