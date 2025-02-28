// Create clients and set shared const values outside of the handler.

// Import required AWS SDK clients
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fetch from "node-fetch";

// Initialize S3 client
const s3Client = new S3Client({});

// Get the S3 bucket name from environment variables
const csvBucket = process.env.CSV_BUCKET;
console.info("Using S3 bucket: ", csvBucket);

/**
 * A function that accepts a pre-signed S3 URL and copies the file to CSVUploadBucket
 */
export const postEnergyUploadHandler = async (event) => {
  if (event.httpMethod !== "POST") {
    throw new Error(`Only POST method is accepted, got: ${event.httpMethod}`);
  }

  // Parse the body
  const body = JSON.parse(event.body);
  const presignedUrl = body.presignedUrl;

  if (!presignedUrl) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Missing presignedUrl in request body" }),
    };
  }

  try {
    // Fetch the content from the pre-signed URL
    console.info("Fetching file from pre-signed URL");
    const response = await fetch(presignedUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch file from pre-signed URL: ${response.statusText}`
      );
    }

    // Get the file content as buffer
    const fileContent = await response.buffer();

    // Extract the user ID from the request context
    const userId = event.requestContext.authorizer?.claims?.sub;

    // Set fileName based on the user ID with the format userId-usage-date.csv
    // processCSVFunction expects the file name to be in this format
    const fileName = `${userId}-usage-${Date.now()}.csv`;

    // Upload the file to the CSVUploadBucket
    console.info(`Uploading file ${fileName} to ${csvBucket}`);
    const putCommand = new PutObjectCommand({
      Bucket: csvBucket,
      Key: fileName,
      Body: fileContent,
      ContentType: response.headers.get("content-type") || "text/csv",
    });

    await s3Client.send(putCommand);

    // Return a success response
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "File successfully copied to CSVUploadBucket",
        fileName: fileName,
      }),
    };
  } catch (error) {
    console.error("Error copying file:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
