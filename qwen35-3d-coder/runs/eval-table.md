| | eval-q8-official | eval-q5km-own | eval-q4km-own |
|---|---:|---:|---:|
| prompts | 20 | 20 | 20 |
| **pass** (no error, WebGL, drawn) | 10 | 9 | 5 |
| finished within 32k tokens | 15 | 14 | 13 |
| page throws an error | 5 | 4 | 8 |
| animated | 5 | 6 | 2 |
| throws / finished | 33% | 29% | 62% |

| id | level | eval-q8-official | eval-q5km-own | eval-q4km-own |
|---|---:|---|---|---|
| scene-000048 | 1 | pass | pass | throw: TypeError: THREE.Object33D is not a cons |
| scene-000049 | 1 | throw: ReferenceError: rightHydrogenPosition is | pass | cap |
| scene-000144 | 2 | pass | pass | pass |
| scene-000145 | 2 | throw: ReferenceError: bossHitObjects is not de | blank | throw: TypeError: Cannot read properties of und |
| scene-000238 | 3 | pass | cap | cap |
| scene-000239 | 3 | cap | pass | pass |
| scene-000334 | 4 | pass | pass | pass |
| scene-000335 | 4 | pass | pass | cap |
| scene-000428 | 5 | cap | cap | cap |
| scene-000429 | 5 | pass | cap | cap |
| scene-000519 | 6 | pass | throw: TypeError: Cannot read properties of und | throw: TypeError: points.map is not a function |
| scene-000520 | 6 | throw: TypeError: Cannot read properties of und | pass | cap |
| scene-000612 | 7 | cap | cap | pass |
| scene-000614 | 7 | cap | pass | throw: ReferenceError: makeWheel is not defined |
| scene-000705 | 8 | cap | pass | throw: SyntaxError: Missing initializer in cons |
| scene-000706 | 8 | pass | throw: TypeError: Cannot read properties of nul | throw: ReferenceError: pressHeadMat is not defi |
| scene-000799 | 9 | pass | cap | throw: TypeError: Cannot read properties of und |
| scene-000800 | 9 | pass | throw: ReferenceError: dwellings is not defined | cap |
| scene-000888 | 10 | throw: ReferenceError: side is not defined | throw: TypeError: Cannot set properties of unde | throw: SyntaxError: Identifier 'label' has alre |
| scene-000889 | 10 | throw: ReferenceError: fires is not defined | cap | pass |
