# refusal probe + codeeval at reasoning_effort low (server default via --chat-template-kwargs; codeeval sets low itself)
VARIANT=base tools/run.sh q-base quality --chat-template-kwargs '{"reasoning_effort":"low"}'
