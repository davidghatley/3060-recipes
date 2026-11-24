# KLD of the uncensored LoRA against the shipped base file's own logits (NOT against BF16: no reference on disk)
tools/kld.sh ref k00-base-ref
tools/kld.sh cmp k01-uncensored-lora /mnt/models/llm/maxwell-v1-flash/uncensored/Maxwell-V1-Flash-Uncensored-LoRA.gguf
