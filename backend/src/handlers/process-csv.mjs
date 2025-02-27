// Create clients and set shared const values outside of the handler.

// Import required AWS SDK clients
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Readable } from "stream";

// Initialize S3 client
const s3Client = new S3Client({});

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

// Get the DynamoDB table name from environment variables
const tableName = process.env.TABLE;

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
 * Lambda function that processes a CSV file uploaded to S3
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

    // Add an ID to each item and store in DynamoDB
    for (const item of items) {
      // Generate a unique ID
      item.id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Save to DynamoDB
      const params = {
        TableName: tableName,
        Item: item,
      };

      await ddbDocClient.send(new PutCommand(params));
      console.info(`Saved item with id ${item.id} to DynamoDB`);
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
