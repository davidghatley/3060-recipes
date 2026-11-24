VARIANT=base tools/run.sh u05-base-ctl-a speed
VARIANT=atomicchat INK_UBATCH=96 tools/run.sh u05-ad-core-ub96 speed
VARIANT=atomicchat INK_UBATCH=64 tools/run.sh u05-ad-core-ub64 speed
VARIANT=atomicchat tools/run.sh u05-ad-core-ub128-nopo speed --no-op-offload
VARIANT=base tools/run.sh u05-base-ctl-b speed
