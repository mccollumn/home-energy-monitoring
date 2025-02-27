// Create clients and set shared const values outside of the handler.
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";

// Create a Cognito Identity Provider client
const client = new CognitoIdentityProviderClient({});

// Get the User Pool ID and Client ID from environment variables
const userPoolId = process.env.USER_POOL_ID;
const clientId = process.env.USER_POOL_CLIENT_ID;

/**
 * A simple function that handles user login using Cognito
 */
export const loginHandler = async (event) => {
  if (event.httpMethod !== "POST") {
    throw new Error(
      `login only accepts POST method, you tried: ${event.httpMethod}`
    );
  }
  
  // All log statements are written to CloudWatch
  console.info("received login request:", event);

  // Get the request body
  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify({
        error: "Invalid request body"
      })
    };
  }

  // Check if required parameters are present
  const { username, password } = requestBody;
  if (!username || !password) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify({
        error: "Username and password are required"
      })
    };
  }

  try {
    // Create the InitiateAuth command
    const initiateAuthCommand = new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      }
    });

    // Execute the command
    const response = await client.send(initiateAuthCommand);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify({
        message: "Login successful",
        idToken: response.AuthenticationResult.IdToken,
        accessToken: response.AuthenticationResult.AccessToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
        expiresIn: response.AuthenticationResult.ExpiresIn
      })
    };
  } catch (error) {
    console.error("Error logging in user:", error);

    return {
      statusCode: error.statusCode || 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify({
        error: error.message || "An error occurred during login"
      })
    };
  }
};