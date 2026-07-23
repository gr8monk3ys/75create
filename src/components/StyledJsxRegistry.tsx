'use client'

import { useState } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { StyleRegistry, createStyleRegistry } from 'styled-jsx'

// styled-jsx needs an explicit registry in the App Router so its styles are
// injected during server rendering. Without this, <style jsx> emits nothing.
export default function StyledJsxRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  const [registry] = useState(() => createStyleRegistry())

  useServerInsertedHTML(() => {
    const styles = registry.styles()
    registry.flush()
    return <>{styles}</>
  })

  return <StyleRegistry registry={registry}>{children}</StyleRegistry>
}
