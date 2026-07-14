# Agent Instructions & Project Rules

## AI Model Selection Policy
Do not hardcode AI model names or libraries directly into the core architecture. Before implementing any AI module, identify the latest stable, open-source, and production-ready models. Compare them based on accuracy, speed, GPU/CPU performance, licensing, documentation, community support, and long-term viability. Select the most optimal variant and document the reasons for selection. Ensure the architecture uses a plugin-based design so that models can be swapped out in the future without modifying the core code.
