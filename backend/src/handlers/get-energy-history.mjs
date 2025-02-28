// Create clients and set shared const values outside of the handler.

// Create a DocumentClient that represents the query to add an item
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
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

// Get the DynamoDB table name from environment variables
const tableName = process.env.TABLE;
console.info("Using DynamoDB table: ", tableName);

// Function for validation of date format
function isValidDate(dateString, format) {
  return moment(dateString, format, true).isValid();
}

/**
 * A function to get energy usage history for a specific date range.
 */
export const getEnergyHistoryHandler = async (event) => {
  if (event.httpMethod !== "GET") {
    throw new Error(
      `getEnergyHistory only accept GET method, you tried: ${event.httpMethod}`
    );
  }
  // All log statements are written to CloudWatch
  console.info("received:", event);

  try {
    // Parse userId from the request - this would come from authentication context in a real app
    const userId = event.requestContext.authorizer?.claims?.sub || "testuser"; // fallback for testing

    // Get query parameters for date range
    const queryParams = event.queryStringParameters || {};
    const { startDate, endDate } = queryParams;

    // Validate required parameters
    if (!startDate || !endDate) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          message:
            "Missing required query parameters: startDate and endDate are required",
        }),
      };
    }

    // Validate date format (YYYY-MM-DD)
    const dateFormat = "YYYY-MM-DD";
    if (
      !isValidDate(startDate, dateFormat) ||
      !isValidDate(endDate, dateFormat)
    ) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          message: "Invalid date format. Required format is YYYY-MM-DD",
        }),
      };
    }

    // Query DynamoDB to get items within the date range
    const params = {
      TableName: tableName,
      KeyConditionExpression:
        "id = :userId AND #date BETWEEN :startDate AND :endDate",
      ExpressionAttributeNames: {
        "#date": "date",
      },
      ExpressionAttributeValues: {
        ":userId": userId,
        ":startDate": startDate,
        ":endDate": endDate,
      },
    };

    const queryResult = await ddbDocClient.send(new QueryCommand(params));

    // Return the result
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(queryResult.Items),
    };
  } catch (error) {
    console.error("Error in getEnergyHistoryHandler:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: "Error retrieving energy history data",
        error: error.message,
      }),
    };
  }
};
