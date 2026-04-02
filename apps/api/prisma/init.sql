-- Initial seed data for Code-Clash
-- This will be executed when PostgreSQL container starts

-- Insert sample problems
INSERT INTO problems (id, title, description, difficulty, test_cases, time_limit_ms, memory_limit_mb, tags, created_at, updated_at) VALUES
('prob-1', 'Two Sum', 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.', 'EASY', 
'[
  {"input": "[2,7,11,15]\n9", "expectedOutput": "[0,1]"},
  {"input": "[3,2,4]\n6", "expectedOutput": "[1,2]"},
  {"input": "[3,3]\n6", "expectedOutput": "[0,1]"}
]', 1000, 128, ARRAY['array', 'hash-table'], NOW(), NOW()),

('prob-2', 'Valid Parentheses', 'Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid.', 'EASY',
'[
  {"input": "()()", "expectedOutput": "true"},
  {"input": "({[]})", "expectedOutput": "true"},
  {"input": "(]", "expectedOutput": "false"},
  {"input": "([)]", "expectedOutput": "false"}
]', 1000, 128, ARRAY['stack', 'string'], NOW(), NOW()),

('prob-3', 'Binary Search', 'Given a sorted array of distinct integers and a target value, return the index if the target is found. Otherwise, return -1.', 'MEDIUM',
'[
  {"input": "[-1,0,3,5,9,12]\n9", "expectedOutput": "4"},
  {"input": "[-1,0,3,5,9,12]\n2", "expectedOutput": "-1"},
  {"input": "[1]\n1", "expectedOutput": "0"}
]', 1000, 128, ARRAY['array', 'binary-search'], NOW(), NOW());
