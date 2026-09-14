# Cultural Collections Search — static prototype

A generated, static snapshot of the [Cultural Collections Search](https://github.com/Enterprise-Services-Group/CCS-prototype-hifi-2026)
Rails app, for stakeholder review with no server (Rails or Solr) required
at request time. Every page here was crawled byte-for-byte from the real
running app; search and faceted filtering on the catalog results page run
entirely in the browser against a JSON export of the Solr index.

**This repo is generated output, not source** — don't edit files here by
hand. To regenerate it, from a checkout of the Rails app:

```bash
bin/rails server                          # in one terminal, with Solr running
bin/rails static:export_data               # writes tmp/static_build/assets/data/*.json
bundle exec ruby script/crawl_static_site.rb   # crawls the app into tmp/static_build/
bin/rails static:publish                   # pushes tmp/static_build/ here as `main`
```

## Hosting

Served via GitHub Pages from the root of `main`. If Pages isn't already
enabled on this repo: **Settings → Pages → Source → Deploy from a branch
→ `main` / `/ (root)`**.
