import {
  TimestreamQueryClient,
  QueryCommand,
} from "@aws-sdk/client-timestream-query";
import moment from "moment";

// Timestream client
const timestreamClient = new TimestreamQueryClient({});

// Get the Timestream database and table name from environment variables
const timestreamDatabaseName = process.env.TIMESTREAM_DATABASE_NAME;
const timestreamTableName = process.env.TIMESTREAM_TABLE_NAME;

console.info("Using Timestream database: ", timestreamDatabaseName);
console.info("Using Timestream table: ", timestreamTableName);

// Function for validation of date format
function isValidDate(dateString, format) {
  return moment(dateString, format, true).isValid();
}

/**
 * Get energy usage history for a specific date range
 * @param {Object} event - The event object containing information about the incoming request.
 * @returns {Object} - An object containing the response status code, headers, and body.
 * @throws {Error} When an error is encountered
 */
export const getEnergyHistoryHandler = async (event) => {
  if (event.httpMethod !== "GET") {
    throw new Error(
      `getEnergyHistory only accept GET method, you tried: ${event.httpMethod}`
    );
  }
  // All log statements are written to CloudWatch
  console.info("received:", event);

  try {
    // Parse userId from the request authentication context
    const userId = event.requestContext.authorizer?.claims?.sub || "testuser"; // fallback for testing

    // Get query parameters for date range
    const queryParams = event.queryStringParameters || {};
    const { startDate, endDate } = queryParams;

    // Validate required parameters
    if (!startDate || !endDate) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          message:
            "Missing required query parameters: startDate and endDate are required",
        }),
      };
    }

    // Validate date format (YYYY-MM-DD)
    const dateFormat = "YYYY-MM-DD";
    if (
      !isValidDate(startDate, dateFormat) ||
      !isValidDate(endDate, dateFormat)
    ) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          message: "Invalid date format. Required format is YYYY-MM-DD",
        }),
      };
    }

    // Query Timestream to get items within the date range
    const query = `
      SELECT time, date, measure_value::double AS usage 
      FROM "${timestreamDatabaseName}"."${timestreamTableName}" 
      WHERE id = '${userId}' 
        AND date BETWEEN '${startDate}' AND '${endDate}'
        AND measure_name = 'energy_usage'
      ORDER BY date ASC
    `;

    console.info("Executing Timestream query:", query);

    const params = {
      QueryString: query,
    };

    const queryResult = await timestreamClient.send(new QueryCommand(params));

    // Process Timestream query results
    const processedResults = [];

    if (queryResult.Rows && queryResult.Rows.length > 0) {
      // Get column names from the QueryResult
      const columnNames = queryResult.ColumnInfo.map((column) => column.Name);

      // Process each row
      queryResult.Rows.forEach((row) => {
        const item = {};

        // Map each data value to its column name
        row.Data.forEach((data, index) => {
          // Check if the column exists
          if (index < columnNames.length) {
            const columnName = columnNames[index];
            // Extract the actual value (Timestream returns different data types)
            item[columnName] = data.ScalarValue || null;
          }
        });

        // Format the item to match the expected structure
        // Ensure we have an object with date, and usage properties
        const formattedItem = {
          date: moment(item.date).format("YYYY-MM-DD"),
          usage: parseFloat(item.usage),
        };

        processedResults.push(formattedItem);
      });
    }

    // Return the result
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(processedResults),
    };
  } catch (error) {
    console.error("Error in getEnergyHistoryHandler:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: "Error retrieving energy history data",
        error: error.message,
      }),
    };
  }
};
