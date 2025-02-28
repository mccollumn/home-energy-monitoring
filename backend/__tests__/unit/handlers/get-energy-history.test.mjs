// Import getEnergyHistoryHandler function from get-energy-history.mjs 
import { getEnergyHistoryHandler } from '../../../src/handlers/get-energy-history.mjs';
// Import Timestream client from AWS SDK 
import { TimestreamQueryClient, QueryCommand } from '@aws-sdk/client-timestream-query';
import { mockClient } from "aws-sdk-client-mock";

// This includes all tests for getEnergyHistoryHandler() 
describe('Test getEnergyHistoryHandler', () => { 
    const timestreamMock = mockClient(TimestreamQueryClient);

    beforeEach(() => {
        timestreamMock.reset();
        
        // Set environment variables
        process.env.TIMESTREAM_DATABASE_NAME = "TestDatabase";
        process.env.TIMESTREAM_TABLE_NAME = "TestTimestreamTable";
    });

    it('should return 400 for non-GET method', async () => { 
        // Create a POST request event
        const event = { 
            httpMethod: 'POST' 
        };

        // Test that the handler throws an error for non-GET method
        await expect(getEnergyHistoryHandler(event)).rejects.toThrow(
            'getEnergyHistoryHandler only accepts GET method, you tried: POST'
        );
    });

    it('should return 400 if userId is missing', async () => { 
        // Create a GET request without userId in queryStringParameters
        const event = { 
            httpMethod: 'GET',
            queryStringParameters: {}
        };

        // Invoke handler
        const result = await getEnergyHistoryHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toContain("Missing required userId");
    });

    it('should return 400 if date range is invalid', async () => { 
        // Create a GET request with invalid date range
        const event = { 
            httpMethod: 'GET',
            queryStringParameters: {
                userId: 'user123',
                startDate: '2023-13-01', // Invalid month
                endDate: '2023-01-01'
            }
        };

        // Invoke handler
        const result = await getEnergyHistoryHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toContain("Invalid date format");
    });

    it('should return 200 with energy history data for daily aggregation', async () => { 
        // Mock Timestream query response for daily aggregation
        const mockQueryResponse = {
            Rows: [
                {
                    Data: [
                        { ScalarValue: '2023-01-01' },
                        { ScalarValue: '120' }
                    ]
                },
                {
                    Data: [
                        { ScalarValue: '2023-01-02' },
                        { ScalarValue: '130' }
                    ]
                }
            ],
            ColumnInfo: [
                { Name: 'date', Type: { ScalarType: 'VARCHAR' } },
                { Name: 'energy', Type: { ScalarType: 'DOUBLE' } }
            ]
        };

        // Setup mock for QueryCommand
        timestreamMock.on(QueryCommand).resolves(mockQueryResponse);

        // Create a GET request for daily aggregation
        const event = { 
            httpMethod: 'GET',
            queryStringParameters: {
                userId: 'user123',
                startDate: '2023-01-01',
                endDate: '2023-01-07',
                aggregation: 'daily'
            }
        };

        // Invoke handler
        const result = await getEnergyHistoryHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual([
            { date: '2023-01-01', energy: 120 },
            { date: '2023-01-02', energy: 130 }
        ]);
    });

    it('should return 200 with energy history data for weekly aggregation', async () => { 
        // Mock Timestream query response for weekly aggregation
        const mockQueryResponse = {
            Rows: [
                {
                    Data: [
                        { ScalarValue: '2023-W01' },
                        { ScalarValue: '800' }
                    ]
                },
                {
                    Data: [
                        { ScalarValue: '2023-W02' },
                        { ScalarValue: '850' }
                    ]
                }
            ],
            ColumnInfo: [
                { Name: 'week', Type: { ScalarType: 'VARCHAR' } },
                { Name: 'energy', Type: { ScalarType: 'DOUBLE' } }
            ]
        };

        // Setup mock for QueryCommand
        timestreamMock.on(QueryCommand).resolves(mockQueryResponse);

        // Create a GET request for weekly aggregation
        const event = { 
            httpMethod: 'GET',
            queryStringParameters: {
                userId: 'user123',
                startDate: '2023-01-01',
                endDate: '2023-01-14',
                aggregation: 'weekly'
            }
        };

        // Invoke handler
        const result = await getEnergyHistoryHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual([
            { week: '2023-W01', energy: 800 },
            { week: '2023-W02', energy: 850 }
        ]);
    });

    it('should return 200 with energy history data for monthly aggregation', async () => { 
        // Mock Timestream query response for monthly aggregation
        const mockQueryResponse = {
            Rows: [
                {
                    Data: [
                        { ScalarValue: '2023-01' },
                        { ScalarValue: '3500' }
                    ]
                },
                {
                    Data: [
                        { ScalarValue: '2023-02' },
                        { ScalarValue: '3200' }
                    ]
                }
            ],
            ColumnInfo: [
                { Name: 'month', Type: { ScalarType: 'VARCHAR' } },
                { Name: 'energy', Type: { ScalarType: 'DOUBLE' } }
            ]
        };

        // Setup mock for QueryCommand
        timestreamMock.on(QueryCommand).resolves(mockQueryResponse);

        // Create a GET request for monthly aggregation
        const event = { 
            httpMethod: 'GET',
            queryStringParameters: {
                userId: 'user123',
                startDate: '2023-01-01',
                endDate: '2023-02-28',
                aggregation: 'monthly'
            }
        };

        // Invoke handler
        const result = await getEnergyHistoryHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual([
            { month: '2023-01', energy: 3500 },
            { month: '2023-02', energy: 3200 }
        ]);
    });

    it('should use default daily aggregation if none specified', async () => { 
        // Mock Timestream query response
        const mockQueryResponse = {
            Rows: [
                {
                    Data: [
                        { ScalarValue: '2023-01-01' },
                        { ScalarValue: '120' }
                    ]
                }
            ],
            ColumnInfo: [
                { Name: 'date', Type: { ScalarType: 'VARCHAR' } },
                { Name: 'energy', Type: { ScalarType: 'DOUBLE' } }
            ]
        };

        // Setup mock for QueryCommand
        timestreamMock.on(QueryCommand).resolves(mockQueryResponse);

        // Create a GET request without specifying aggregation
        const event = { 
            httpMethod: 'GET',
            queryStringParameters: {
                userId: 'user123',
                startDate: '2023-01-01',
                endDate: '2023-01-07'
                // No aggregation specified
            }
        };

        // Invoke handler
        const result = await getEnergyHistoryHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual([
            { date: '2023-01-01', energy: 120 }
        ]);
    });

    it('should return 500 on query error', async () => { 
        // Setup mock for QueryCommand to throw an error
        timestreamMock.on(QueryCommand).rejects(new Error("Database query failed"));

        // Create a valid GET request
        const event = { 
            httpMethod: 'GET',
            queryStringParameters: {
                userId: 'user123',
                startDate: '2023-01-01',
                endDate: '2023-01-07'
            }
        };

        // Invoke handler
        const result = await getEnergyHistoryHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain("Error retrieving energy history");
    });
});