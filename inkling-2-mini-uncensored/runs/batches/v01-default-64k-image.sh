# The shipped default (VARIANT unset = atomicchat, ub 96, 64k) with image input: does the mmproj still fit at 64k?
MMPROJ_SMOKE=1 UNC_MMPROJ=1 tools/run.sh v-default-64k-mmproj-f16 smoke
MMPROJ_SMOKE=1 UNC_MMPROJ=1 NEEDLES=62000 tools/run.sh v-default-64k-mmproj-f16-needle needles
