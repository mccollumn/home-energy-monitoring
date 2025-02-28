import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  TimestreamWriteClient,
  WriteRecordsCommand,
} from "@aws-sdk/client-timestream-write";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

// Initialize S3 client
const s3Client = new S3Client({});

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

// Get the DynamoDB table name from environment variables
const tableName = process.env.TABLE;

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

// Helper function to convert S3 object stream to string
const streamToString = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
};

// Helper function to parse CSV data
const parseCSV = (csvData) => {
  const lines = csvData.trim().split("\n");
  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    const item = {};

    headers.forEach((header, index) => {
      item[header] = values[index];
    });

    return item;
  });
};

/**
 * Processes a CSV file uploaded to S3 and writes the data to Timestream.
 * @param {Object} event - S3 event that triggered the Lambda function
 * @returns {Object} response - The response object containing a status code and message
 * @throws {Error} When an error is encountered
 */
export const processCSVHandler = async (event) => {
  console.info("Received event:", JSON.stringify(event, null, 2));

  // Get the object from the event
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );

  console.info(`Processing file ${key} from bucket ${bucket}`);

  try {
    // Get the object from S3
    const getObjectParams = {
      Bucket: bucket,
      Key: key,
    };

    const { Body } = await s3Client.send(new GetObjectCommand(getObjectParams));
    const fileContent = await streamToString(Body);

    // Parse CSV data
    const items = parseCSV(fileContent);
    console.info(`Parsed ${items.length} items from CSV file`);

    for (const item of items) {
      // Extract user ID from file metadata or S3 event
      // Since the user ID isn't in the key, extract it from the filename itself
      // Assuming filenames follow pattern: userId_filename.csv or userId-filename.csv
      let userId = "unknown";
      const fileNameMatch = key.match(/^([^_\-]+)[_\-]/);
      if (fileNameMatch && fileNameMatch.length > 1) {
        userId = fileNameMatch[1];
      }

      // Set the user ID as the item ID
      item.id = userId;

      // Check if the user has a threshold set and compare with current usage
      try {
        // Get the user's threshold from DynamoDB
        const getUserParams = {
          TableName: tableName,
          Key: { id: cognitoSub },
          ProjectionExpression: "threshold",
        };

        const userResult = await ddbDocClient.send(
          new GetCommand(getUserParams)
        );
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
    }

    console.info(`Successfully processed ${items.length} items from ${key}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully processed ${items.length} items from ${key}`,
      }),
    };
  } catch (err) {
    console.error("Error processing CSV file:", err);
    throw err;
  }
};
