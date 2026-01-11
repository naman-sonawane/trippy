#!/bin/bash
echo "Starting Gesture Swiper for Trippy"
echo "==================================="
echo ""

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: ./start_gesture_swiper.sh [user_id] [destination]"
    echo "Example: ./start_gesture_swiper.sh user_test Paris"
    echo ""
    read -p "Enter User ID: " user_id
    read -p "Enter Destination: " destination
else
    user_id=$1
    destination=$2
fi

if [ -z "$destination" ]; then
    echo "Error: Both user_id and destination are required!"
    exit 1
fi

echo ""
echo "Starting gesture swiper for user '$user_id' going to '$destination'"
echo ""
echo "Controls:"
echo "- Swipe LEFT with your hand to pass"
echo "- Swipe RIGHT with your hand to like"
echo "- Press 'q' to quit"
echo ""

cd "$(dirname "$0")"
python gesture_server.py "$user_id" "$destination"
