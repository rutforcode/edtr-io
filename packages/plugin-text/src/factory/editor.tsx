import {
  StatefulPluginEditorProps,
  EditorContext,
  getPlugins,
  Plugin,
  OverlayContext,
  useEditorFocus
} from '@edtr-io/core'
import isHotkey from 'is-hotkey'
import * as React from 'react'
import { Editor, EventHook, findNode } from 'slate-react'
import {
  Editor as CoreEditor,
  Value,
  ValueJSON,
  Range as CoreRange
} from 'slate'

import { isValueEmpty, TextPlugin } from '..'
import { TextPluginOptions } from './types'
import { textState } from '.'
import { katexBlockNode, katexInlineNode } from '../plugins/katex'
import { linkNode } from '../plugins/link'

export const createTextEditor = (
  options: TextPluginOptions
): React.ComponentType<SlateEditorProps> => {
  const schema = {
    inlines: {
      [katexInlineNode]: {
        isVoid: true
      },
      [linkNode]: {
        text: /.+/
      }
    },
    blocks: {
      [katexBlockNode]: {
        isVoid: true
      }
    }
  }
  return function SlateEditor(props: SlateEditorProps) {
    const { focusPrevious, focusNext } = useEditorFocus()
    const editor = React.useRef<Editor>()
    const store = React.useContext(EditorContext)
    const overlayContext = React.useContext(OverlayContext)
    const plugins = getPlugins(store.state)
    const [rawState, setRawState] = React.useState(
      Value.fromJSON(props.state.value)
    )
    const lastValue = React.useRef(props.state.value)
    React.useEffect(() => {
      if (lastValue.current !== props.state.value) {
        setRawState(Value.fromJSON(props.state.value))
        lastValue.current = props.state.value
        setTimeout(() => {
          if (!editor.current) return
          if (props.focused) {
            editor.current.focus()
          }
        })
      }
    }, [lastValue, props.focused, props.state.value])

    // PLEASE DONT FIX THIS! Closure needed because on* isn't recreated so doesnt use current props
    const slateClosure = React.useRef<SlateClosure>({
      name: props.name,
      plugins: plugins,
      insert: props.insert,
      replace: props.replace,
      remove: props.remove,
      parent: props.parent,
      focusPrevious: focusPrevious,
      focusNext: focusNext,
      mergeWithNext: props.mergeWithNext,
      mergeWithPrevious: props.mergeWithPrevious
    })
    slateClosure.current = {
      name: props.name,
      plugins: plugins,
      insert: props.insert,
      replace: props.replace,
      remove: props.remove,
      parent: props.parent,
      focusPrevious: focusPrevious,
      focusNext: focusNext,
      mergeWithNext: props.mergeWithNext,
      mergeWithPrevious: props.mergeWithPrevious
    }
    React.useEffect(() => {
      if (!editor.current) return
      if (props.focused) {
        setTimeout(editor.current.focus)
      } else {
        editor.current.blur()
      }
    }, [props.focused])

    const pluginClosure = React.useRef({
      overlayContext,
      name: props.name,
      parent: props.parent
    })
    pluginClosure.current = {
      overlayContext,
      name: props.name,
      parent: props.parent
    }
    const slatePlugins = React.useRef<TextPlugin[]>()
    if (slatePlugins.current === undefined) {
      slatePlugins.current = [
        ...options.plugins.map(slatePluginFactory =>
          slatePluginFactory(pluginClosure)
        ),
        newSlateOnEnter(slateClosure)
      ]
    }

    return (
      <Editor
        ref={slateReact => {
          if (slateReact && !editor.current) {
            editor.current = slateReact
            patchSlateInsertFragment(slateReact)
          }
        }}
        // ref={editor as React.RefObject<Editor>}
        onPaste={createOnPaste(slateClosure)}
        onKeyDown={createOnKeyDown(slateClosure)}
        onClick={(e, editor, next): CoreEditor | void => {
          if (e.target) {
            // @ts-ignore
            const node = findNode(e.target as Element, editor)
            if (!node) {
              return editor
            }
          }
          next()
        }}
        onChange={change => {
          const nextValue = change.value.toJSON()
          setRawState(change.value)
          const withoutSelections = change.operations.filter(
            operation =>
              typeof operation !== 'undefined' &&
              operation.type !== 'set_selection'
          )
          if (!withoutSelections.isEmpty()) {
            lastValue.current = nextValue
            props.state.set(nextValue)
          }
        }}
        placeholder={props.editable ? options.placeholder : ''}
        plugins={slatePlugins.current}
        readOnly={!props.focused}
        value={rawState}
        schema={schema}
      />
    )
  }
}

// PLEASE DONT FIX THIS! Closure needed because onPaste isn't recreated so doesnt use props
function createOnPaste(slateClosure: React.RefObject<SlateClosure>): EventHook {
  return (e, editor, next): void => {
    if (!slateClosure.current) {
      next()
      return
    }

    const { plugins, insert, name } = slateClosure.current
    if (typeof insert !== 'function') {
      next()
      return
    }

    const { clipboardData } = e as ClipboardEvent

    for (let key in plugins) {
      const { onPaste } = plugins[key]
      if (typeof onPaste === 'function') {
        const result = onPaste(clipboardData)
        if (result !== undefined) {
          const nextSlateState = splitBlockAtSelection(editor)

          setTimeout(() => {
            insert({ plugin: name, state: nextSlateState })
            insert({ plugin: key, state: result.state })
          })
          return
        }
      }
    }

    next()
  }
}

// PLEASE DONT FIX THIS! Closure needed because onKeyDown isn't recreated so doesnt use props
function createOnKeyDown(
  slateClosure: React.RefObject<SlateClosure>
): EventHook {
  return (e, editor, next): void => {
    const { key } = (e as unknown) as React.KeyboardEvent

    if (
      isHotkey('mod+z', e as KeyboardEvent) ||
      isHotkey('mod+y', e as KeyboardEvent) ||
      isHotkey('mod+shift+z', e as KeyboardEvent)
    ) {
      e.preventDefault()
      return
    }

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const lastRange = getRange()

      if (lastRange) {
        const lastY = lastRange.getBoundingClientRect().top
        setTimeout(() => {
          if (!slateClosure.current) {
            return
          }
          const currentRange = getRange()
          if (!currentRange) {
            return
          }
          const currentY = currentRange.getBoundingClientRect().top
          if (lastY === currentY) {
            if (key === 'ArrowDown') {
              slateClosure.current.focusNext()
            } else {
              slateClosure.current.focusPrevious()
            }
          }
        })
      }
    }

    if (key === 'Backspace' && selectionAtStart(editor)) {
      if (!slateClosure.current) return
      if (isValueEmpty(editor.value)) {
        // focus previous plugin and remove self
        const { remove, focusPrevious } = slateClosure.current
        if (typeof remove === 'function') {
          if (typeof focusPrevious === 'function') {
            focusPrevious()
          }
          remove()
        }
      } else {
        // merge with previous plugin
        const { mergeWithPrevious } = slateClosure.current
        if (typeof mergeWithPrevious !== 'function') return

        mergeWithPrevious(previous => {
          const value = Value.fromJSON(previous)
          const selection = CoreRange.create(editor.value.selection)
          return editor
            .insertFragmentAtRange(selection, value.document)
            .value.toJSON()
        })
      }
      return
    }

    if (key === 'Delete' && selectionAtEnd(editor)) {
      if (!slateClosure.current) return
      if (isValueEmpty(editor.value)) {
        // focus previous plugin and remove self
        const { remove, focusNext } = slateClosure.current
        if (typeof remove === 'function') {
          if (typeof focusNext === 'function') {
            focusNext()
          }
          remove()
        }
      } else {
        const { mergeWithNext } = slateClosure.current
        if (typeof mergeWithNext !== 'function') return

        mergeWithNext(next => {
          const value = Value.fromJSON(next)
          const selection = CoreRange.create(editor.value.selection)
          editor
            .insertFragmentAtRange(selection, value.document)
            .select(selection)
        })
      }
      return
    }

    return next()
  }

  function getRange(): Range | null {
    const selection = window.getSelection()

    if (selection.rangeCount > 0) {
      return selection.getRangeAt(0)
    }

    return null
  }
  function selectionAtStart(editor: CoreEditor) {
    const { selection } = editor.value
    const startNode = editor.value.document.getFirstText()
    return (
      selection.isCollapsed &&
      startNode &&
      editor.value.startText.key === startNode.key &&
      selection.start.offset === 0
    )
  }
  function selectionAtEnd(editor: CoreEditor) {
    const { selection } = editor.value
    const endNode = editor.value.document.getLastText()
    return (
      selection.isCollapsed &&
      endNode &&
      editor.value.endText.key === endNode.key &&
      selection.end.offset === editor.value.endText.text.length
    )
  }
}
function newSlateOnEnter(
  slateClosure: React.RefObject<SlateClosure>
): TextPlugin {
  return {
    commands: {
      replaceWithPlugin(editor, options?: { plugin: string; state: unknown }) {
        if (!slateClosure.current) return editor
        const { replace } = slateClosure.current
        if (typeof replace !== 'function') return editor
        replace(options)
        return editor
      },
      unwrapParent(editor) {
        if (!slateClosure.current) return editor
        const parentWithReplace = findParentWith(
          'replace',
          slateClosure.current
        )
        if (
          parentWithReplace &&
          typeof parentWithReplace.replace === 'function'
        ) {
          parentWithReplace.replace({
            plugin: slateClosure.current.name,
            state: editor.value.toJSON()
          })
        }
        return editor
      }
    },
    onKeyDown(e, editor, next) {
      if (
        isHotkey('enter', e as KeyboardEvent) &&
        !editor.value.selection.isExpanded
      ) {
        // remove text plugin and insert on parent if plugin is empty
        if (isValueEmpty(editor.value) && slateClosure.current) {
          const parentWithInsert = findParentWith(
            'insert',
            slateClosure.current
          )
          if (parentWithInsert) {
            e.preventDefault()
            setTimeout(() => {
              if (!slateClosure.current) return next()
              const { remove } = slateClosure.current
              if (
                typeof remove === 'function' &&
                typeof parentWithInsert.insert === 'function'
              ) {
                parentWithInsert.insert({ plugin: slateClosure.current.name })
                remove()
              }
            })
            return
          }
        }
        // remove block and insert plugin on parent, if block is empty
        if (
          editor.value.startText.text === '' &&
          editor.value.startBlock.nodes.size === 1 &&
          slateClosure.current
        ) {
          const parentWithInsert = findParentWith(
            'insert',
            slateClosure.current
          )
          if (parentWithInsert) {
            e.preventDefault()
            if (!slateClosure.current) return next()
            if (typeof parentWithInsert.insert === 'function') {
              editor.delete()
              parentWithInsert.insert({ plugin: slateClosure.current.name })
            }
            return
          }
        }

        if (
          slateClosure.current &&
          typeof slateClosure.current.insert === 'function'
        ) {
          e.preventDefault()
          const nextSlateState = splitBlockAtSelection(editor)

          setTimeout(() => {
            if (!slateClosure.current) return next()
            const { insert } = slateClosure.current
            if (typeof insert !== 'function') return
            insert({ plugin: slateClosure.current.name, state: nextSlateState })
          })
          return
        }
      }
      return next()
    }
  }
}

// search recursively for a parent with the required function
function findParentWith(
  funcQuery: 'insert' | 'replace',
  closure: SlateEditorAdditionalProps
): SlateEditorAdditionalProps | undefined {
  if (!closure.parent) return

  if (typeof closure.parent[funcQuery] === 'function') return closure.parent

  return findParentWith(funcQuery, closure.parent)
}

function splitBlockAtSelection(editor: CoreEditor) {
  if (editor.value.focusBlock.type == katexBlockNode) {
    // If katex block node is focused, don't attempt to split it, insert empty paragraph instead
    editor.moveToEndOfBlock()
    editor.insertBlock('paragraph')
  } else {
    editor.splitBlock(1)
  }
  const blocks = editor.value.document.getBlocks()

  const afterSelected = blocks.skipUntil(block => {
    if (!block) {
      return false
    }
    return editor.value.blocks.first().key === block.key
  })

  afterSelected.forEach(block => {
    if (!block) return

    editor.removeNodeByKey(block.key)
  })

  return {
    document: {
      nodes: [...afterSelected.map(block => block && block.toJSON()).toJS()]
    }
  }
}

export type SlateEditorProps = StatefulPluginEditorProps<
  typeof textState,
  SlateEditorAdditionalProps
>

export interface SlateEditorAdditionalProps {
  name: string
  insert?: (options?: { plugin: string; state?: unknown }) => void
  replace?: (options?: { plugin: string; state?: unknown }) => void
  remove?: () => void
  parent?: SlateEditorAdditionalProps
  mergeWithNext?: (merge: (next: ValueJSON) => void) => void
  mergeWithPrevious?: (merge: (previous: ValueJSON) => void) => void
}

interface SlateClosure extends SlateEditorAdditionalProps {
  focusPrevious: () => void
  focusNext: () => void
  plugins: Record<string, Plugin>
}

// TEMPORARY
// Testbed for integration of slate fix
// polyfilling slate editor
function patchSlateInsertFragment(reacteditor: Editor) {
  // @ts-ignore
  const editor = reacteditor as CoreEditor
  // @ts-ignore
  editor.insertFragment = fragment => {
    if (!fragment.nodes.size) return editor

    if (editor.value.selection.isExpanded) {
      editor.delete()
    }

    let { value } = editor
    let { document, selection } = value
    const { start, end } = selection
    const { startText, endText, startInline } = value
    const lastText = fragment.getLastText()
    // @ts-ignore
    const lastInline = fragment.getClosestInline(lastText.key)
    // @ts-ignore
    const lastBlock = fragment.getClosestBlock(lastText.key)
    const firstChild = fragment.nodes.first()
    const lastChild = fragment.nodes.last()
    // @ts-ignore
    const keys = document.getTexts().map(text => text.key)
    const isAppending =
      !startInline ||
      (start.isAtStartOfNode(startText) || end.isAtStartOfNode(startText)) ||
      (start.isAtEndOfNode(endText) || end.isAtEndOfNode(endText))

    const isInserting =
      firstChild.hasBlockChildren() || lastChild.hasBlockChildren()

    // @ts-ignore
    editor.insertFragmentAtRange(selection, fragment)
    value = editor.value
    document = value.document

    // @ts-ignore
    const newTexts = document.getTexts().filter(n => !keys.includes(n.key))
    const newText = isAppending ? newTexts.last() : newTexts.takeLast(2).first()

    if (newText && (lastInline || isInserting)) {
      editor.moveToEndOfNode(newText)
    } else if (newText && lastBlock) {
      // Changed code
      const lastInlineIndex = lastBlock.nodes.findLastIndex(node => {
        if (!node) return false
        return node.object == 'inline'
      })
      const skipLength = lastBlock.nodes
        .takeLast(lastBlock.nodes.size - lastInlineIndex - 1)
        .reduce((num, v) => {
          if (!num) num = 0
          if (v) return num + v.text.length
          return num
        }, 0)
      editor.moveToStartOfNode(newText).moveForward(skipLength)
    }
    return editor
  }
}
