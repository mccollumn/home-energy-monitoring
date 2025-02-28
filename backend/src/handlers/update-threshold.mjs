import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

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

/**
 * Updates a user's threshold value in the DynamoDB table.
 * @param {Object} event - The event object containing information about the incoming request.
 * @returns {Object} - An object containing the response status code, headers, and body.
 * @throws {Error} When an error is encountered
 */
export const updateThresholdHandler = async (event) => {
  if (event.httpMethod !== "POST") {
    throw new Error(
      `updateThreshold only accepts POST method, you tried: ${event.httpMethod} method.`
    );
  }
  // All log statements are written to CloudWatch
  console.info("received:", event);

  // Get threshold from the body of the request
  const body = JSON.parse(event.body);
  const threshold = body.threshold;

  // Get user ID from the request context (from Cognito authorizer)
  const userId = event.requestContext.authorizer?.claims?.sub;

  if (!userId) {
    return {
      statusCode: 401,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ message: "Not authenticated" }),
    };
  }

  if (threshold === undefined) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        message: "Missing threshold value in request body",
      }),
    };
  }

  // UpdateCommand will update just the threshold attribute, or create the item if it doesn't exist
  const params = {
    TableName: tableName,
    Key: { id: userId },
    UpdateExpression: "SET threshold = :thresholdValue",
    ExpressionAttributeValues: {
      ":thresholdValue": threshold,
    },
    ReturnValues: "UPDATED_NEW",
  };

  try {
    const data = await ddbDocClient.send(new UpdateCommand(params));
    console.log("Success - threshold updated", data);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        message: "Threshold updated successfully",
        updatedAttributes: data.Attributes,
      }),
    };
  } catch (err) {
    console.error("Error updating threshold:", err.message);
    console.error("Error code:", err.code);
    console.error("Error name:", err.name);
    console.error("Error stack:", err.stack);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        message: "Error updating threshold",
        error: err.message,
      }),
    };
  }
};
