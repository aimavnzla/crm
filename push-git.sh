#!/bin/bash
set -e
cd /c/Users/User/Documents/omnirouter-claude/aima-crm
git config user.email "deploy@aima.com"
git config user.name "AIMA Deploy"
git add -A
git commit --allow-empty -m "AIMA CRM multi-user web app - ready for Vercel"
git branch -M main
git remote add origin https://github.com/aimavnzla/crm.git
git push -u origin main --force
echo "Push completed successfully!"