// Import loginHandler function from auth-login.mjs 
import { loginHandler } from '../../../src/handlers/auth-login.mjs';
// Import Cognito client from AWS SDK 
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { mockClient } from "aws-sdk-client-mock";

// This includes all tests for loginHandler() 
describe('Test loginHandler', () => { 
    const cognitoMock = mockClient(CognitoIdentityProviderClient);

    beforeEach(() => {
        cognitoMock.reset();
    });

    it('should return 400 for non-POST method', async () => { 
        // Create a GET request event
        const event = { 
            httpMethod: 'GET' 
        };

        // Test that the handler throws an error for non-POST method
        await expect(loginHandler(event)).rejects.toThrow(
            'login only accepts POST method, you tried: GET'
        );
    });

    it('should return 400 if request body is invalid JSON', async () => { 
        // Create a POST request event with invalid JSON body
        const event = { 
            httpMethod: 'POST',
            body: 'not-a-json'
        };

        // Invoke handler
        const result = await loginHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe("Invalid request body");
    });

    it('should return 400 if username or password is missing', async () => { 
        // Create a POST request event with missing parameters
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ username: 'testuser' }) // missing password
        };

        // Invoke handler
        const result = await loginHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toContain("Missing required parameters");
    });

    it('should return 200 and auth tokens on successful login', async () => { 
        // Mock response from Cognito
        const mockTokens = {
            AuthenticationResult: {
                AccessToken: 'test-access-token',
                IdToken: 'test-id-token',
                RefreshToken: 'test-refresh-token'
            }
        };

        // Setup mock for InitiateAuthCommand
        cognitoMock.on(InitiateAuthCommand).resolves(mockTokens);

        // Create a POST request with valid credentials
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                username: 'testuser',
                password: 'password123'
            })
        };

        // Invoke handler
        const result = await loginHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            accessToken: 'test-access-token',
            idToken: 'test-id-token',
            refreshToken: 'test-refresh-token'
        });
    });

    it('should return 401 on invalid credentials', async () => { 
        // Setup mock for InitiateAuthCommand to throw an error
        cognitoMock.on(InitiateAuthCommand).rejects({
            name: 'NotAuthorizedException',
            message: 'Incorrect username or password.'
        });

        // Create a POST request with invalid credentials
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                username: 'testuser',
                password: 'wrongpassword'
            })
        };

        // Invoke handler
        const result = await loginHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(401);
        expect(JSON.parse(result.body).error).toBe("Incorrect username or password.");
    });

    it('should return 500 on unexpected error', async () => { 
        // Setup mock for InitiateAuthCommand to throw an unexpected error
        cognitoMock.on(InitiateAuthCommand).rejects({
            name: 'InternalErrorException',
            message: 'An internal error occurred'
        });

        // Create a POST request
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                username: 'testuser',
                password: 'password123'
            })
        };

        // Invoke handler
        const result = await loginHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain("An error occurred");
    });
});