We need to add a guideline to this bot prompt: TODO_PATH

Make it clear, when implementing fixes, this bot will never create .md prompts or scripts (.js/.py/.sh). It will only apply patches and inline fixes to existing files. It can adjust the wording of prompts, or the logic of scripts code. We should assume the high-level architecture is correct, and we're simply applying patches or tiny refactors to improve an existing script.
