#!/bin/zsh

# Define an array of PHP server commands
servers=(
    "npm --prefix ./fe run start"
    "php -S localhost:9999 -t ./be"
    "php -S localhost:1234 -t ./embed"
    "npm run dev --prefix embed"
)

# Define a function to execute when the script is closed
function on_exit {
    echo "Stopping PHP servers"
    for pid in "${pids[@]}"; do
        kill "$pid"
    done
}

# Trap the INT and TERM signals and execute the on_exit function
trap on_exit INT TERM

# Start each PHP server sequentially and save its PID
for cmd in "${servers[@]}"; do
    eval "$cmd" &
    pids+=("$!")
done

# Open the fake artist frontend
open "http://localhost:1234"

# Wait for all PHP servers to exit
wait
