# Share links never carry artifacts

The MVP spec (F8) let the owner toggle logs *and artifacts* into a share
link. Share links carry their snapshot in the URL fragment, so they work with
no server and nothing is uploaded to share. Images don't fit in a URL, and
publishing them would need hosting that the local-first build doesn't have.
So a share link carries the grid, the stats and, if the owner opts in, the
logs; artifacts stay private. Artifacts are the person's work, and private by
default is a product principle (PRODUCT.md).
