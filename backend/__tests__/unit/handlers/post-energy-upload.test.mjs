// Import postEnergyUploadHandler function from post-energy-upload.mjs 
import { postEnergyUploadHandler } from '../../../src/handlers/post-energy-upload.mjs';
// Import S3 client from AWS SDK 
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from "aws-sdk-client-mock";
// Mock node-fetch
import fetch from 'node-fetch';
jest.mock('node-fetch');

// This includes all tests for postEnergyUploadHandler() 
describe('Test postEnergyUploadHandler', () => { 
    const s3Mock = mockClient(S3Client);

    beforeEach(() => {
        s3Mock.reset();
        
        // Set environment variables
        process.env.CSV_BUCKET = "XXXXXXXXXXXXXXX";
        
        // Reset fetch mock
        fetch.mockReset();
    });

    it('should return 400 for non-POST method', async () => { 
        // Create a GET request event
        const event = { 
            httpMethod: 'GET' 
        };

        // Test that the handler throws an error for non-POST method
        await expect(postEnergyUploadHandler(event)).rejects.toThrow(
            'Only POST method is accepted, got: GET'
        );
    });

    it('should return 400 if presignedUrl is missing in request body', async () => { 
        // Create a POST request event with missing presignedUrl
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({
                // No presignedUrl field
            })
        };

        // Invoke handler
        const result = await postEnergyUploadHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe("Missing presignedUrl in request body");
    });

    it('should return 500 if fetch from presignedUrl fails', async () => { 
        // Mock fetch to throw an error
        fetch.mockRejectedValue(new Error("Failed to fetch from URL"));

        // Create a valid POST request
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({
                presignedUrl: 'https://example.com/presigned-url'
            })
        };

        // Invoke handler
        const result = await postEnergyUploadHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain("Failed to fetch from URL");
    });

    it('should return 500 if fetch response is not ok', async () => { 
        // Mock fetch to return a non-ok response
        fetch.mockResolvedValue({
            ok: false,
            statusText: 'Not Found'
        });

        // Create a valid POST request
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({
                presignedUrl: 'https://example.com/presigned-url'
            })
        };

        // Invoke handler
        const result = await postEnergyUploadHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain("Failed to fetch file from pre-signed URL");
    });

    it('should return 500 if S3 upload fails', async () => { 
        // Mock fetch to return successful response with buffer method
        const mockBuffer = Buffer.from('test file content');
        fetch.mockResolvedValue({
            ok: true,
            buffer: jest.fn().mockResolvedValue(mockBuffer)
        });

        // Mock S3 PutObject to fail
        s3Mock.on(PutObjectCommand).rejects(new Error("Failed to upload to S3"));

        // Create a valid POST request with user context
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({
                presignedUrl: 'https://example.com/presigned-url'
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
        const result = await postEnergyUploadHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain("Failed to upload to S3");
    });

    it('should return 200 and success message on successful upload', async () => { 
        // Mock fetch to return successful response with buffer method
        const mockBuffer = Buffer.from('test file content');
        fetch.mockResolvedValue({
            ok: true,
            buffer: jest.fn().mockResolvedValue(mockBuffer)
        });

        // Mock S3 PutObject to succeed
        s3Mock.on(PutObjectCommand).resolves({
            ETag: '"mockETag"'
        });

        // Create a valid POST request with user context
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({
                presignedUrl: 'https://example.com/presigned-url'
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
        const result = await postEnergyUploadHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: "File uploaded successfully",
            fileName: expect.any(String)
        });

        // Verify S3 was called with correct parameters
        const s3Calls = s3Mock.commandCalls(PutObjectCommand);
        expect(s3Calls.length).toBe(1);
        const s3Call = s3Calls[0].args[0];
        expect(s3Call.input.Bucket).toBe("test-csv-bucket");
        expect(s3Call.input.Key).toContain("user123/");
        expect(s3Call.input.ContentType).toBe("text/csv");
    });

    it('should use default user ID if authentication context is not present', async () => { 
        // Mock fetch to return successful response with buffer method
        const mockBuffer = Buffer.from('test file content');
        fetch.mockResolvedValue({
            ok: true,
            buffer: jest.fn().mockResolvedValue(mockBuffer)
        });

        // Mock S3 PutObject to succeed
        s3Mock.on(PutObjectCommand).resolves({});

        // Create a valid POST request without user context
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({
                presignedUrl: 'https://example.com/presigned-url'
            })
            // No requestContext
        };

        // Invoke handler
        const result = await postEnergyUploadHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);

        // Verify S3 was called with default user
        const s3Calls = s3Mock.commandCalls(PutObjectCommand);
        expect(s3Calls.length).toBe(1);
        const s3Call = s3Calls[0].args[0];
        // Should contain a default user ID or anonymous user path
        expect(s3Call.input.Key).toBeDefined();
    });
});