// Import updateThresholdHandler function from update-threshold.mjs 
import { updateThresholdHandler } from '../../../src/handlers/update-threshold.mjs';
// Import DynamoDB client from AWS SDK 
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

// This includes all tests for updateThresholdHandler() 
describe('Test updateThresholdHandler', () => { 
    const ddbMock = mockClient(DynamoDBDocumentClient);

    beforeEach(() => {
        ddbMock.reset();
        
        // Set environment variables
        process.env.TABLE = "TestTable";
    });

    it('should return 400 for non-PUT method', async () => { 
        // Create a GET request event
        const event = { 
            httpMethod: 'GET' 
        };

        // Test that the handler throws an error for non-PUT method
        await expect(updateThresholdHandler(event)).rejects.toThrow(
            'updateThresholdHandler only accepts PUT method, you tried: GET'
        );
    });

    it('should return 400 if request body is invalid JSON', async () => { 
        // Create a PUT request event with invalid JSON body
        const event = { 
            httpMethod: 'PUT',
            body: 'not-a-json'
        };

        // Invoke handler
        const result = await updateThresholdHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe("Invalid request body");
    });

    it('should return 400 if threshold is missing in request body', async () => { 
        // Create a PUT request event with missing threshold
        const event = { 
            httpMethod: 'PUT',
            body: JSON.stringify({ 
                // No threshold field
            })
        };

        // Invoke handler
        const result = await updateThresholdHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe("Missing threshold in request body");
    });

    it('should return 400 if threshold is not a number', async () => { 
        // Create a PUT request event with non-numeric threshold
        const event = { 
            httpMethod: 'PUT',
            body: JSON.stringify({ 
                threshold: "not-a-number"
            })
        };

        // Invoke handler
        const result = await updateThresholdHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe("Threshold must be a number");
    });

    it('should return 400 if threshold is a negative number', async () => { 
        // Create a PUT request event with negative threshold
        const event = { 
            httpMethod: 'PUT',
            body: JSON.stringify({ 
                threshold: -100
            })
        };

        // Invoke handler
        const result = await updateThresholdHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe("Threshold must be a positive number");
    });

    it('should update threshold for an existing user', async () => { 
        // Mock DynamoDB GetCommand to return an existing user
        ddbMock.on(GetCommand, {
            TableName: "TestTable",
            Key: { id: "user123" }
        }).resolves({
            Item: {
                id: "user123",
                threshold: 100  // Current threshold
            }
        });

        // Mock DynamoDB UpdateCommand
        ddbMock.on(UpdateCommand).resolves({
            Attributes: {
                id: "user123",
                threshold: 150  // Updated threshold
            }
        });

        // Create a valid PUT request with userId from authentication context
        const event = { 
            httpMethod: 'PUT',
            body: JSON.stringify({ 
                threshold: 150  // New threshold
            }),
            requestContext: {
                authorizer: {
                    claims: {
                        sub: 'user123'
                    }
                }
            }
        };

        // Invoke handler
        const result = await updateThresholdHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: "Threshold updated successfully",
            id: "user123",
            threshold: 150
        });

        // Verify DynamoDB UpdateCommand was called with correct parameters
        const updateCalls = ddbMock.commandCalls(UpdateCommand);
        expect(updateCalls.length).toBe(1);
        const updateCall = updateCalls[0].args[0];
        expect(updateCall.input.TableName).toBe("TestTable");
        expect(updateCall.input.Key).toEqual({ id: "user123" });
        expect(updateCall.input.UpdateExpression).toBe("set threshold = :t");
        expect(updateCall.input.ExpressionAttributeValues).toEqual({ ":t": 150 });
    });

    it('should create a new user entry if user does not exist', async () => { 
        // Mock DynamoDB GetCommand to return null (user does not exist)
        ddbMock.on(GetCommand).resolves({});

        // Mock DynamoDB UpdateCommand
        ddbMock.on(UpdateCommand).resolves({
            Attributes: {
                id: "newuser",
                threshold: 200
            }
        });

        // Create a valid PUT request
        const event = { 
            httpMethod: 'PUT',
            body: JSON.stringify({ 
                threshold: 200
            }),
            requestContext: {
                authorizer: {
                    claims: {
                        sub: 'newuser'
                    }
                }
            }
        };

        // Invoke handler
        const result = await updateThresholdHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: "Threshold updated successfully",
            id: "newuser",
            threshold: 200
        });

        // Verify DynamoDB UpdateCommand was called
        expect(ddbMock.commandCalls(UpdateCommand).length).toBe(1);
    });

    it('should use a default user ID if authentication context is missing', async () => { 
        // Mock DynamoDB GetCommand
        ddbMock.on(GetCommand).resolves({});

        // Mock DynamoDB UpdateCommand
        ddbMock.on(UpdateCommand).resolves({
            Attributes: {
                threshold: 300
            }
        });

        // Create a valid PUT request without authentication context
        const event = { 
            httpMethod: 'PUT',
            body: JSON.stringify({ 
                threshold: 300
            })
            // No requestContext.authorizer.claims.sub
        };

        // Invoke handler
        const result = await updateThresholdHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        
        // Verify DynamoDB UpdateCommand was called with some default ID
        const updateCalls = ddbMock.commandCalls(UpdateCommand);
        expect(updateCalls.length).toBe(1);
        expect(updateCalls[0].args[0].input.Key.id).toBeDefined();
    });

    it('should return 500 on DynamoDB error', async () => { 
        // Mock DynamoDB GetCommand
        ddbMock.on(GetCommand).resolves({
            Item: {
                id: "user123"
            }
        });

        // Mock DynamoDB UpdateCommand to throw an error
        ddbMock.on(UpdateCommand).rejects(new Error("Database update failed"));

        // Create a valid PUT request
        const event = { 
            httpMethod: 'PUT',
            body: JSON.stringify({ 
                threshold: 150
            }),
            requestContext: {
                authorizer: {
                    claims: {
                        sub: 'user123'
                    }
                }
            }
        };

        // Invoke handler
        const result = await updateThresholdHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain("Error updating threshold");
    });
});