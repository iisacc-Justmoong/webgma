# Publishing Checklist

## What this project prepares

- root [manifest.json](/Volumes/Storage/Workspace/Product/Webgma/manifest.json) for local development import
- `npm run prepare:release` to generate `build/release/`
- release-ready `manifest.json` inside `build/release/` with relative asset paths for distribution

## Pre-publish checklist

1. Use the Figma desktop app.
2. Enable two-factor authentication on the publishing account.
3. Run `npm run prepare:release`.
4. In Figma, import the release manifest from `build/release/manifest.json` if you want to verify the packaged form.
5. Confirm the manifest still matches the product behavior:
   - `editorType` is `figma`
   - `documentAccess` is `dynamic-page`
   - `networkAccess` explains why unrestricted image fetch is needed
6. Prepare Community listing assets:
   - icon: 128 x 128px recommended
   - thumbnail: 1920 x 1080px recommended
   - support contact
   - name, tagline, description, category
7. Publish from `Plugins > Manage plugins` in the Figma desktop app.

## Notes

- The plugin `id` is intentionally not hard-coded here. Figma assigns it when you create the plugin draft or publish it.
- If image fetching requirements become narrower, replace `allowedDomains: ["*"]` with a restricted list before submission.

## Official references

- [Plugin manifest docs](https://developers.figma.com/docs/plugins/manifest/)
- [Publishing docs](https://developers.figma.com/docs/plugins/publishing/)
- [Community publish guide](https://help.figma.com/hc/en-us/articles/360042293394-Publish-plugins-to-the-Figma-Community)
