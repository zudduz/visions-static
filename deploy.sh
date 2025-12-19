#!/bin/bash
if ! firebase projects:list > /dev/null 2>&1; then
  echo "You are not logged into Firebase. Please run 'firebase login' and try again."
  exit 1
fi
firebase deploy --only hosting
