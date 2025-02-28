// Import processCSVHandler function from process-csv.mjs 
import { processCSVHandler } from '../../../src/handlers/process-csv.mjs';
// Import AWS SDK clients
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { TimestreamWriteClient, WriteRecordsCommand } from "@aws-sdk/client-timestream-write";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { mockClient } from "aws-sdk-client-mock";
import { Readable } from 'stream';

// Mock event helpers
const createS3Event = (bucket, key) => {
  return {
    Records: [
      {
        s3: {
          bucket: {
            name: bucket
          },
          object: {
            key: key
          }
        }
      }
    ]
  };
};

// Helper function to create a readable stream from a string
const createReadableStream = (string) => {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(string);
  readable.push(null);
  return readable;
};

// This includes all tests for processCSVHandler() 
describe('Test processCSVHandler', () => { 
    const s3Mock = mockClient(S3Client);
    const ddbMock = mockClient(DynamoDBDocumentClient);
    const timestreamMock = mockClient(TimestreamWriteClient);
    const snsMock = mockClient(SNSClient);

    beforeEach(() => {
        s3Mock.reset();
        ddbMock.reset();
        timestreamMock.reset();
        snsMock.reset();
        
        // Set environment variables
        process.env.TABLE = "TestTable";
        process.env.TIMESTREAM_DATABASE_NAME = "TestDatabase";
        process.env.TIMESTREAM_TABLE_NAME = "TestTimestreamTable";
        process.env.SNS_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:TestTopic";
    });

    it('should successfully process a valid CSV file', async () => {
        // Sample CSV content with header row and two data rows
        const csvContent = "timestamp,energy\n2023-01-01T12:00:00Z,100\n2023-01-02T12:00:00Z,200";
        
        // Mock S3 GetObjectCommand to return a readable stream of the CSV content
        s3Mock.on(GetObjectCommand).resolves({
            Body: createReadableStream(csvContent)
        });

        // Mock DynamoDB GetCommand for user threshold (extract userId from filename)
        ddbMock.on(GetCommand, {
            TableName: "TestTable",
            Key: { id: "user123" }
        }).resolves({
            Item: {
                id: "user123",
                threshold: 150
            }
        });

        // Mock Timestream WriteRecordsCommand
        timestreamMock.on(WriteRecordsCommand).resolves({});

        // Mock SNS PublishCommand for thresholds exceeded
        snsMock.on(PublishCommand).resolves({
            MessageId: "test-message-id"
        });

        // Create an S3 event
        const event = createS3Event("test-bucket", "user123_energy_data.csv");

        // Invoke handler
        const result = await processCSVHandler(event);

        // Verify the function executed successfully
        expect(result).toBeDefined();
        expect(result.statusCode).toBe(200);
        
        // Verify S3 GetObjectCommand was called
        expect(s3Mock.calls()).toHaveLength(1);
        
        // Verify Timestream WriteRecordsCommand was called twice (once for each row)
        expect(timestreamMock.calls()).toHaveLength(2);
        
        // Verify SNS PublishCommand was called once (for the second row where energy > threshold)
        expect(snsMock.calls()).toHaveLength(1);
    });

    it('should handle a CSV file with invalid data format', async () => {
        // Sample CSV content with header row and invalid data rows (missing timestamp)
        const csvContent = "timestamp,energy\n,100\nNot a date,200";
        
        // Mock S3 GetObjectCommand
        s3Mock.on(GetObjectCommand).resolves({
            Body: createReadableStream(csvContent)
        });

        // Mock DynamoDB GetCommand for user threshold
        ddbMock.on(GetCommand).resolves({
            Item: {
                threshold: 150
            }
        });

        // Mock Timestream and SNS responses
        timestreamMock.on(WriteRecordsCommand).resolves({});
        snsMock.on(PublishCommand).resolves({});

        // Create an S3 event
        const event = createS3Event("test-bucket", "user123_energy_data.csv");

        // Invoke handler
        const result = await processCSVHandler(event);

        // Verify the function handled the error gracefully
        expect(result).toBeDefined();
        expect(result.statusCode).toBe(200);
        
        // No Timestream write calls should happen for invalid data
        expect(timestreamMock.calls()).toHaveLength(0);
        
        // No SNS notifications should be sent
        expect(snsMock.calls()).toHaveLength(0);
    });

    it('should handle errors when retrieving file from S3', async () => {
        // Mock S3 GetObjectCommand to throw an error
        s3Mock.on(GetObjectCommand).rejects(new Error("Access Denied"));

        // Create an S3 event
        const event = createS3Event("test-bucket", "user123_energy_data.csv");

        // Invoke handler
        const result = await processCSVHandler(event);

        // Verify the function handled the error gracefully
        expect(result).toBeDefined();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain("Error retrieving file from S3");
    });

    it('should handle errors during Timestream write operations', async () => {
        // Sample CSV content
        const csvContent = "timestamp,energy\n2023-01-01T12:00:00Z,100";
        
        // Mock S3 GetObjectCommand
        s3Mock.on(GetObjectCommand).resolves({
            Body: createReadableStream(csvContent)
        });

        // Mock DynamoDB GetCommand for user threshold
        ddbMock.on(GetCommand).resolves({
            Item: {
                threshold: 150
            }
        });

        // Mock Timestream WriteRecordsCommand to throw an error
        timestreamMock.on(WriteRecordsCommand).rejects(new Error("Timestream write failed"));

        // Create an S3 event
        const event = createS3Event("test-bucket", "user123_energy_data.csv");

        // Invoke handler
        const result = await processCSVHandler(event);

        // Verify the function handled the error gracefully
        expect(result).toBeDefined();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain("Error processing CSV data");
    });

    it('should process CSV file with missing userId in filename', async () => {
        // Sample CSV content
        const csvContent = "timestamp,energy\n2023-01-01T12:00:00Z,100";
        
        // Mock S3 GetObjectCommand
        s3Mock.on(GetObjectCommand).resolves({
            Body: createReadableStream(csvContent)
        });

        // Mock DynamoDB GetCommand
        ddbMock.on(GetCommand).resolves({});

        // Mock Timestream WriteRecordsCommand
        timestreamMock.on(WriteRecordsCommand).resolves({});

        // Create an S3 event with a filename that doesn't contain userId
        const event = createS3Event("test-bucket", "energy_data.csv");

        // Invoke handler
        const result = await processCSVHandler(event);

        // Verify the function executed using a default userId
        expect(result).toBeDefined();
        expect(result.statusCode).toBe(200);
        
        // Verify Timestream WriteRecordsCommand was still called
        expect(timestreamMock.calls()).toHaveLength(1);
    });

    it('should handle empty CSV files', async () => {
        // Empty CSV content (just header)
        const csvContent = "timestamp,energy\n";
        
        // Mock S3 GetObjectCommand
        s3Mock.on(GetObjectCommand).resolves({
            Body: createReadableStream(csvContent)
        });

        // Create an S3 event
        const event = createS3Event("test-bucket", "user123_energy_data.csv");

        // Invoke handler
        const result = await processCSVHandler(event);

        // Verify the function executed successfully but did no processing
        expect(result).toBeDefined();
        expect(result.statusCode).toBe(200);
        
        // Verify no Timestream calls happened
        expect(timestreamMock.calls()).toHaveLength(0);
    });

    it('should handle CSV files with missing required headers', async () => {
        // CSV content missing the energy column
        const csvContent = "timestamp\n2023-01-01T12:00:00Z";
        
        // Mock S3 GetObjectCommand
        s3Mock.on(GetObjectCommand).resolves({
            Body: createReadableStream(csvContent)
        });

        // Create an S3 event
        const event = createS3Event("test-bucket", "user123_energy_data.csv");

        // Invoke handler
        const result = await processCSVHandler(event);

        // Verify the function executed with appropriate error handling
        expect(result).toBeDefined();
        expect(result.statusCode).toBe(200);
        
        // Verify no Timestream calls happened
        expect(timestreamMock.calls()).toHaveLength(0);
    });

    it('should send notification when energy exceeds threshold', async () => {
        // Sample CSV content with energy value exceeding threshold
        const csvContent = "timestamp,energy\n2023-01-01T12:00:00Z,200";
        
        // Mock S3 GetObjectCommand
        s3Mock.on(GetObjectCommand).resolves({
            Body: createReadableStream(csvContent)
        });

        // Mock DynamoDB GetCommand for user threshold set to lower value
        ddbMock.on(GetCommand).resolves({
            Item: {
                threshold: 100
            }
        });

        // Mock Timestream and SNS
        timestreamMock.on(WriteRecordsCommand).resolves({});
        snsMock.on(PublishCommand).resolves({
            MessageId: "test-message-id"
        });

        // Create an S3 event
        const event = createS3Event("test-bucket", "user123_energy_data.csv");

        // Invoke handler
        const result = await processCSVHandler(event);

        // Verify the function executed successfully
        expect(result).toBeDefined();
        expect(result.statusCode).toBe(200);
        
        // Verify SNS notification was sent
        expect(snsMock.calls()).toHaveLength(1);
    });

    it('should handle SNS notification failures gracefully', async () => {
        // Sample CSV content with energy value exceeding threshold
        const csvContent = "timestamp,energy\n2023-01-01T12:00:00Z,200";
        
        // Mock S3 GetObjectCommand
        s3Mock.on(GetObjectCommand).resolves({
            Body: createReadableStream(csvContent)
        });

        // Mock DynamoDB GetCommand for user threshold
        ddbMock.on(GetCommand).resolves({
            Item: {
                threshold: 100
            }
        });

        // Mock Timestream to succeed
        timestreamMock.on(WriteRecordsCommand).resolves({});
        
        // Mock SNS to fail
        snsMock.on(PublishCommand).rejects(new Error("SNS publish failed"));

        // Create an S3 event
        const event = createS3Event("test-bucket", "user123_energy_data.csv");

        // Invoke handler
        const result = await processCSVHandler(event);

        // Verify the function executed successfully despite SNS failure
        expect(result).toBeDefined();
        expect(result.statusCode).toBe(200);
        
        // Data should still be written to Timestream
        expect(timestreamMock.calls()).toHaveLength(1);
    });
});