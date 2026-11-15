# Build and test layout

The Figma plugin bundle is the default build target and is written to
`build/plugin/`. The optional release packaging command remains explicit.
Fixture source data for cleanup and packaging tests is created under
`resources/test-workspaces/` and removed afterward. The syntax-compatibility
check builds its temporary plugin bundle under `build/` and removes it after
inspection. Neither build nor these tests starts Figma or runs the plugin.
