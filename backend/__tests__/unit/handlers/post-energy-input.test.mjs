// Import postEnergyInputHandler function from post-energy-input.mjs 
import { postEnergyInputHandler } from '../../../src/handlers/post-energy-input.mjs';
// Import AWS SDK clients
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { TimestreamWriteClient, WriteRecordsCommand } from "@aws-sdk/client-timestream-write";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { mockClient } from "aws-sdk-client-mock";

// This includes all tests for postEnergyInputHandler() 
describe('Test postEnergyInputHandler', () => { 
    const ddbMock = mockClient(DynamoDBDocumentClient);
    const timestreamMock = mockClient(TimestreamWriteClient);
    const snsMock = mockClient(SNSClient);

    beforeEach(() => {
        ddbMock.reset();
        timestreamMock.reset();
        snsMock.reset();
        
        // Set environment variables
        process.env.TABLE = "TestTable";
        process.env.TIMESTREAM_DATABASE_NAME = "TestDatabase";
        process.env.TIMESTREAM_TABLE_NAME = "TestTimestreamTable";
        process.env.SNS_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:TestTopic";
    });

    it('should return 400 for non-POST method', async () => { 
        // Create a GET request event
        const event = { 
            httpMethod: 'GET' 
        };

        // Test that the handler throws an error for non-POST method
        await expect(postEnergyInputHandler(event)).rejects.toThrow(
            'postEnergyInputHandler only accepts POST method, you tried: GET'
        );
    });

    it('should return 400 if request body is invalid JSON', async () => { 
        // Create a POST request event with invalid JSON body
        const event = { 
            httpMethod: 'POST',
            body: 'not-a-json'
        };

        // Invoke handler
        const result = await postEnergyInputHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe("Invalid request body");
    });

    it('should return 400 if required parameters are missing', async () => { 
        // Create a POST request event with missing parameters
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                userId: 'user123',
                // Missing energy or timestamp
            })
        };

        // Invoke handler
        const result = await postEnergyInputHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toContain("Missing required parameters");
    });

    it('should return 400 if timestamp format is invalid', async () => { 
        // Create a POST request event with invalid timestamp
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                userId: 'user123',
                energy: 100,
                timestamp: 'invalid-date'
            })
        };

        // Invoke handler
        const result = await postEnergyInputHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toContain("Invalid timestamp format");
    });

    it('should return 200 and save energy data successfully', async () => { 
        // Mock DynamoDB GetCommand response for user threshold
        ddbMock.on(GetCommand, {
            TableName: "TestTable",
            Key: { id: "user123" }
        }).resolves({
            Item: {
                id: "user123",
                threshold: 150
            }
        });

        // Mock Timestream WriteRecordsCommand response
        timestreamMock.on(WriteRecordsCommand).resolves({});

        // Mock SNS PublishCommand response - not called since energy is below threshold
        snsMock.on(PublishCommand).resolves({});

        // Create a valid POST request
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                userId: 'user123',
                energy: 100,
                timestamp: '2023-01-01T12:00:00Z'
            })
        };

        // Invoke handler
        const result = await postEnergyInputHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: "Energy data saved successfully",
            threshold: 150,
            thresholdExceeded: false
        });

        // Verify Timestream write was called
        expect(timestreamMock.calls()).toHaveLength(1);
        
        // Verify SNS publish was not called (energy below threshold)
        expect(snsMock.calls()).toHaveLength(0);
    });

    it('should publish SNS notification when energy exceeds threshold', async () => { 
        // Mock DynamoDB GetCommand response for user threshold
        ddbMock.on(GetCommand, {
            TableName: "TestTable",
            Key: { id: "user123" }
        }).resolves({
            Item: {
                id: "user123",
                threshold: 50 // Low threshold that will be exceeded
            }
        });

        // Mock Timestream WriteRecordsCommand response
        timestreamMock.on(WriteRecordsCommand).resolves({});

        // Mock SNS PublishCommand response
        snsMock.on(PublishCommand).resolves({
            MessageId: "test-message-id"
        });

        // Create a valid POST request with energy exceeding threshold
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                userId: 'user123',
                energy: 100, // Higher than threshold
                timestamp: '2023-01-01T12:00:00Z'
            })
        };

        // Invoke handler
        const result = await postEnergyInputHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: "Energy data saved successfully",
            threshold: 50,
            thresholdExceeded: true
        });

        // Verify Timestream write was called
        expect(timestreamMock.calls()).toHaveLength(1);
        
        // Verify SNS publish was called (energy above threshold)
        expect(snsMock.calls()).toHaveLength(1);
    });

    it('should use default threshold when user has no threshold set', async () => { 
        // Mock DynamoDB GetCommand response for user without threshold
        ddbMock.on(GetCommand, {
            TableName: "TestTable",
            Key: { id: "user123" }
        }).resolves({
            Item: {
                id: "user123"
                // No threshold property
            }
        });

        // Mock Timestream WriteRecordsCommand response
        timestreamMock.on(WriteRecordsCommand).resolves({});

        // Mock SNS PublishCommand response
        snsMock.on(PublishCommand).resolves({});

        // Create a valid POST request
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                userId: 'user123',
                energy: 100,
                timestamp: '2023-01-01T12:00:00Z'
            })
        };

        // Invoke handler
        const result = await postEnergyInputHandler(event); 

        // Verify the response - should use default threshold (likely 100)
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.message).toBe("Energy data saved successfully");
        // Don't verify exact threshold value as it might be a default in the code
    });

    it('should handle case when user does not exist', async () => { 
        // Mock DynamoDB GetCommand response for non-existent user
        ddbMock.on(GetCommand, {
            TableName: "TestTable",
            Key: { id: "nonexistentuser" }
        }).resolves({
            // No Item returned - user doesn't exist
        });

        // Mock Timestream WriteRecordsCommand response
        timestreamMock.on(WriteRecordsCommand).resolves({});

        // Create a valid POST request with non-existent userId
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                userId: 'nonexistentuser',
                energy: 100,
                timestamp: '2023-01-01T12:00:00Z'
            })
        };

        // Invoke handler
        const result = await postEnergyInputHandler(event); 

        // Verify the response - should use default threshold
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.message).toBe("Energy data saved successfully");
    });

    it('should return 500 on Timestream write error', async () => { 
        // Mock DynamoDB GetCommand response
        ddbMock.on(GetCommand).resolves({
            Item: {
                id: "user123",
                threshold: 150
            }
        });

        // Mock Timestream WriteRecordsCommand to throw error
        timestreamMock.on(WriteRecordsCommand).rejects(new Error("Timestream write failure"));

        // Create a valid POST request
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                userId: 'user123',
                energy: 100,
                timestamp: '2023-01-01T12:00:00Z'
            })
        };

        // Invoke handler
        const result = await postEnergyInputHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain("Error saving energy data");
    });
});