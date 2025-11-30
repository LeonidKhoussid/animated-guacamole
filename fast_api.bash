#!/bin/bash
start "" bash -c "uvicorn main:app --log-level debug; exec bash"