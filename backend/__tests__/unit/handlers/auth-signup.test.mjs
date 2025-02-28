// Import signupHandler function from auth-signup.mjs 
import { signupHandler } from '../../../src/handlers/auth-signup.mjs';
// Import Cognito client from AWS SDK 
import { CognitoIdentityProviderClient, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { mockClient } from "aws-sdk-client-mock";

// This includes all tests for signupHandler() 
describe('Test signupHandler', () => { 
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
        await expect(signupHandler(event)).rejects.toThrow(
            'signup only accepts POST method, you tried: GET'
        );
    });

    it('should return 400 if request body is invalid JSON', async () => { 
        // Create a POST request event with invalid JSON body
        const event = { 
            httpMethod: 'POST',
            body: 'not-a-json'
        };

        // Invoke handler
        const result = await signupHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe("Invalid request body");
    });

    it('should return 400 if required parameters are missing', async () => { 
        // Create a POST request event with missing parameters
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                username: 'testuser',
                // Missing password and email
            })
        };

        // Invoke handler
        const result = await signupHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toContain("Missing required parameters");
    });

    it('should return 200 on successful signup', async () => { 
        // Mock response from Cognito
        const mockResponse = {
            UserConfirmed: false,
            UserSub: 'test-user-id'
        };

        // Setup mock for SignUpCommand
        cognitoMock.on(SignUpCommand).resolves(mockResponse);

        // Create a POST request with valid registration data
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                username: 'testuser',
                password: 'Password123!',
                email: 'test@example.com'
            })
        };

        // Invoke handler
        const result = await signupHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: "User registration successful",
            userConfirmed: false,
            userId: 'test-user-id'
        });
    });

    it('should return 400 on username already exists error', async () => { 
        // Setup mock for SignUpCommand to throw an error for existing username
        cognitoMock.on(SignUpCommand).rejects({
            name: 'UsernameExistsException',
            message: 'User already exists'
        });

        // Create a POST request with an existing username
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                username: 'existinguser',
                password: 'Password123!',
                email: 'test@example.com'
            })
        };

        // Invoke handler
        const result = await signupHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe("User already exists");
    });

    it('should return 400 on invalid password format', async () => { 
        // Setup mock for SignUpCommand to throw an invalid password error
        cognitoMock.on(SignUpCommand).rejects({
            name: 'InvalidPasswordException',
            message: 'Password does not conform to policy'
        });

        // Create a POST request with an invalid password
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                username: 'testuser',
                password: 'weak',
                email: 'test@example.com'
            })
        };

        // Invoke handler
        const result = await signupHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe("Password does not conform to policy");
    });

    it('should return 500 on unexpected error', async () => { 
        // Setup mock for SignUpCommand to throw an unexpected error
        cognitoMock.on(SignUpCommand).rejects({
            name: 'InternalErrorException',
            message: 'An internal error occurred'
        });

        // Create a POST request
        const event = { 
            httpMethod: 'POST',
            body: JSON.stringify({ 
                username: 'testuser',
                password: 'Password123!',
                email: 'test@example.com'
            })
        };

        // Invoke handler
        const result = await signupHandler(event); 

        // Verify the response
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain("An error occurred");
    });
});