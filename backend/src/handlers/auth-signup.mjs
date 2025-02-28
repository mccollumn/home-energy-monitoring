import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

// Create a Cognito Identity Provider client
const client = new CognitoIdentityProviderClient({});

// Get the User Pool ID and Client ID from environment variables
const userPoolId = process.env.USER_POOL_ID;
const clientId = process.env.USER_POOL_CLIENT_ID;

/**
 * Handle user signup using Cognito
 * @param {object} event - HTTP request from API Gateway
 * @returns {object} HTTP response with status code and body
 * @throws {Error} When an error is encountered
 */
export const signupHandler = async (event) => {
  if (event.httpMethod !== "POST") {
    throw new Error(
      `signup only accepts POST method, you tried: ${event.httpMethod}`
    );
  }

  // All log statements are written to CloudWatch
  console.info("received signup request:", event);

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
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        error: "Invalid request body",
      }),
    };
  }

  // Check if required parameters are present
  const { username, password, email } = requestBody;
  if (!username || !password || !email) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        error: "Username, password, and email are required",
      }),
    };
  }

  try {
    // Create the SignUp command
    const signUpCommand = new SignUpCommand({
      ClientId: clientId,
      Username: username,
      Password: password,
      UserAttributes: [
        {
          Name: "email",
          Value: email,
        },
      ],
    });

    // Execute the command
    const response = await client.send(signUpCommand);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        message: "User registration successful",
        username: username,
        userConfirmed: response.UserConfirmed,
        userSub: response.UserSub,
      }),
    };
  } catch (error) {
    console.error("Error signing up user:", error);

    return {
      statusCode: error.statusCode || 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        error: error.message || "An error occurred during user registration",
      }),
    };
  }
};
