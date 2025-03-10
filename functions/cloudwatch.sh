#!/bin/bash

# Configuration
AWS_REGION="eu-west-3" 
LOG_GROUP_NAME="allisone-plus-log-group"

# Default time range (last 24 hours if not specified)
DEFAULT_END_TIME=$(date +%s)
DEFAULT_START_TIME=$((DEFAULT_END_TIME - 86400))

START_TIME=""
END_TIME=""
USER_ID=""
VERSION=""
LIMIT=100
DEBUG=false
AWS_PROFILE="default"  # Default AWS profile

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --start-time)
            START_TIME="$2"
            shift 2
            ;;
        --end-time)
            END_TIME="$2"
            shift 2
            ;;
        --user-id)
            USER_ID="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --limit)
            LIMIT="$2"
            shift 2
            ;;
        --profile)
            AWS_PROFILE="$2"
            shift 2
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Use default values if not provided
START_TIME=${START_TIME:-$DEFAULT_START_TIME}
END_TIME=${END_TIME:-$DEFAULT_END_TIME}

# Check that times are in seconds, not milliseconds
if [ ${#START_TIME} -gt 10 ]; then
    # Convert from milliseconds to seconds if needed
    START_TIME=$((START_TIME / 1000))
    if [ "$DEBUG" = true ]; then
        echo "Converted start time from milliseconds to seconds: $START_TIME" >&2
    fi
fi

if [ ${#END_TIME} -gt 10 ]; then
    # Convert from milliseconds to seconds if needed
    END_TIME=$((END_TIME / 1000))
    if [ "$DEBUG" = true ]; then
        echo "Converted end time from milliseconds to seconds: $END_TIME" >&2
    fi
fi

# Validate required parameters
if [ -z "$USER_ID" ] || [ -z "$VERSION" ]; then
    echo "{\"error\": \"User ID and version are required\"}"
    exit 1
fi

# List available AWS profiles for debugging
if [ "$DEBUG" = true ]; then
    echo "Available AWS profiles:" >&2
    if command -v aws &> /dev/null; then
        aws configure list-profiles >&2
    else
        echo "AWS CLI not found in PATH" >&2
    fi
    echo "" >&2
fi

# Find AWS CLI executable
AWS_CMD="aws"
if ! command -v aws &> /dev/null; then
    # Try to find AWS CLI in standard locations
    if [ -f "/usr/local/bin/aws" ]; then
        AWS_CMD="/usr/local/bin/aws"
    elif [ -f "/usr/bin/aws" ]; then
        AWS_CMD="/usr/bin/aws"
    elif [ -f "$HOME/.local/bin/aws" ]; then
        AWS_CMD="$HOME/.local/bin/aws"
    elif [ -f "/mnt/c/Program Files/Amazon/AWSCLIV2/aws.exe" ]; then
        # Windows path when running in WSL
        AWS_CMD="/mnt/c/Program Files/Amazon/AWSCLIV2/aws.exe"
    else
        echo "{\"error\": \"AWS CLI not found. Please install AWS CLI and make sure it is in your PATH\"}"
        exit 1
    fi
fi

if [ "$DEBUG" = true ]; then
    echo "Using AWS CLI: $AWS_CMD" >&2
    echo "AWS Profile: $AWS_PROFILE" >&2
fi

# Check AWS credentials
AWS_IDENTITY=$("$AWS_CMD" sts get-caller-identity --profile "$AWS_PROFILE" 2>/dev/null)
IDENTITY_EXIT_CODE=$?

if [ $IDENTITY_EXIT_CODE -ne 0 ]; then
    echo "{\"error\": \"AWS credentials not valid. Please run 'aws sso login --profile $AWS_PROFILE' and try again\"}"
    exit 1
fi

if [ "$DEBUG" = true ]; then
    echo "AWS Identity: $AWS_IDENTITY" >&2
fi

# Construct the query
QUERY_STRING="fields @timestamp, @message, @logStream 
| filter @logStream like '[production]-[$VERSION]_[$USER_ID]' 
| sort @timestamp desc
| limit $LIMIT"

if [ "$DEBUG" = true ]; then
    echo "Debug Info:" >&2
    echo "AWS Profile: $AWS_PROFILE" >&2
    echo "AWS Region: $AWS_REGION" >&2
    echo "Log Group: $LOG_GROUP_NAME" >&2
    echo "Start Time: $START_TIME" >&2
    echo "End Time: $END_TIME" >&2
    echo "User ID: $USER_ID" >&2
    echo "Version: $VERSION" >&2
    echo "Query: $QUERY_STRING" >&2
fi

# Execute CloudWatch query
QUERY_RESULT=$("$AWS_CMD" logs start-query \
    --log-group-name "$LOG_GROUP_NAME" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --query-string "$QUERY_STRING" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --output json 2>&1)

QUERY_EXIT_CODE=$?

if [ $QUERY_EXIT_CODE -ne 0 ]; then
    echo "{\"error\": \"Failed to start CloudWatch query\", \"details\": \"$QUERY_RESULT\"}"
    exit 1
fi

# Extract query ID
QUERY_ID=$(echo "$QUERY_RESULT" | grep -o '"queryId": "[^"]*"' | cut -d'"' -f4)

if [ -z "$QUERY_ID" ]; then
    echo "{\"error\": \"Failed to extract query ID\", \"details\": \"$QUERY_RESULT\"}"
    exit 1
fi

if [ "$DEBUG" = true ]; then
    echo "Query ID: $QUERY_ID" >&2
fi

# Poll for results
TIMEOUT=30
START_POLL_TIME=$SECONDS

while true; do
    # Check for timeout
    if [ $((SECONDS - START_POLL_TIME)) -gt $TIMEOUT ]; then
        echo "{\"error\": \"Query timed out after $TIMEOUT seconds\"}"
        exit 1
    fi

    # Fetch query results
    RESULTS=$("$AWS_CMD" logs get-query-results \
        --query-id "$QUERY_ID" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --output json 2>&1)
    
    GET_RESULTS_EXIT_CODE=$?
    
    if [ $GET_RESULTS_EXIT_CODE -ne 0 ]; then
        echo "{\"error\": \"Failed to get query results\", \"details\": \"$RESULTS\"}"
        exit 1
    fi
    
    # Extract status
    STATUS=$(echo "$RESULTS" | grep -o '"status": "[^"]*"' | cut -d'"' -f4)
    
    # Handle query completion
    if [ "$STATUS" = "Complete" ]; then
        echo "$RESULTS"
        exit 0
    elif [ "$STATUS" = "Failed" ]; then
        echo "{\"error\": \"Query execution failed\", \"details\": \"$RESULTS\"}"
        exit 1
    fi
    
    # Wait before next poll
    sleep 1
done