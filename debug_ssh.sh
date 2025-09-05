#!/bin/bash

echo "=== SSH DEBUG SCRIPT ==="
echo ""

echo "1. Проверяем SSH ключи в агенте:"
ssh-add -l
echo ""

echo "2. Тестируем SSH подключение к GitHub (verbose):"
ssh -vT git@github.com
echo ""

echo "3. Тестируем конкретный ключ:"
ssh -i ~/.ssh/id_ed25519_mexcscalp -T git@github.com
echo ""

echo "4. Проверяем remote URL:"
git remote -v
echo ""

echo "5. Проверяем статус git:"
git status
echo ""

echo "=== КОНЕЦ ОТЛАДКИ ==="




