import wrap from '../src/wrapAstTransformation'
import type { ASTTransformation } from '../src/wrapAstTransformation'
import { getCntFunc } from '../src/report'

import type * as N from 'jscodeshift'
import { transformAST as removeExtraneousImport } from './remove-extraneous-import'

const transformEmit: ASTTransformation = (context) => {
  const { root, j } = context

  const defaultExportBody = root.find(j.ExportDefaultDeclaration)
    if (!defaultExportBody.length) return

  const defineComponent = defaultExportBody.find(j.CallExpression, {
    callee: { type: 'Identifier', name: 'defineComponent' }
  })
  if(!defineComponent.length) return

  const emitsProperty = defaultExportBody.find(j.ObjectProperty, { key: { name: 'emits' } })
  if(!emitsProperty.length) return

  if(j.ArrayExpression.check(emitsProperty.get('value').node)) {
    const defineEmit = j.variableDeclaration(
      'const', [
        j.variableDeclarator(
          j.identifier('emit'),
          j.callExpression(
            j.identifier('defineEmits'),
            [emitsProperty.get('value').node]
          )
        )
    ])

    defaultExportBody.insertBefore(defineEmit)
  }

  if(j.ObjectExpression.check(emitsProperty.get('value').node)) {
    const defineEmit = j.variableDeclaration(
      'const', [
        j.variableDeclarator(
          j.identifier('emit'),
          j.callExpression(
            j.identifier('defineEmits'),
            [emitsProperty.get('value').node]
          )
        )
    ])

    defaultExportBody.insertBefore(defineEmit)
  }

  const contextEmits = root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      object: {
        name: 'context'
      },
      property: {
        name: 'emit'
      }
    }
  })
  if(contextEmits.length) {
    contextEmits.forEach(contextEmit => {
      contextEmit.node.callee = j.identifier('emit')
    })
  }
}

const transformProps: ASTTransformation = (context) => {
  const { root, j } = context

  const defaultExportBody = root.find(j.ExportDefaultDeclaration)
  if (!defaultExportBody.length) return

  const defineComponent = defaultExportBody.find(j.CallExpression, {
    callee: { type: 'Identifier', name: 'defineComponent' }
  })
  if(!defineComponent.length) return

  const propsProperty = defaultExportBody.find(j.ObjectProperty, { key: { name: 'props' } }).at(0)
  if(!propsProperty.length) return

  const propsObject = defaultExportBody
    .find(j.ObjectProperty, { key: { name: 'props' } })
    .filter(node => node.parent.parent.parent.node.type === 'ExportDefaultDeclaration')
    .paths()[0].node.value as N.ObjectExpression

  const defineProps = j.callExpression(j.identifier('defineProps'), [
    propsObject,
  ])
  const props = j.variableDeclaration('const', [
    j.variableDeclarator(j.identifier('props'), defineProps)
  ])
  defaultExportBody.insertBefore(props)
}

const transformComponent: ASTTransformation = (context) => {
  const { root, j } = context

  const defaultExportBody = root.find(j.ExportDefaultDeclaration)
    if (!defaultExportBody.length) return

  const defineComponent = defaultExportBody.find(j.CallExpression, {
    callee: { type: 'Identifier', name: 'defineComponent' }
  })
  if(!defineComponent.length) return

  const componentBlock = defaultExportBody.find(j.ObjectProperty, {
    key: { name: 'components' }, value: { type: 'ObjectExpression' }
  })
  if(!componentBlock.length) return

  const componentsProperties = componentBlock.get('value').node.properties as N.ObjectProperty[]
  const asyncComponents = componentsProperties.filter((node) => node.value.type !== 'Identifier')
  if (!asyncComponents.length) return

  const lastImportDecl = root.find(j.ImportDeclaration).at(-1)

  asyncComponents.forEach(asyncComponent => {
    if(j.CallExpression.check(asyncComponent.value)) {
      const defineEmit = j.variableDeclaration(
        'const', [
          j.variableDeclarator(
            asyncComponent.key,
            asyncComponent.value,
          )
      ])

      if (lastImportDecl.length) {
        lastImportDecl.insertAfter(defineEmit)
      } else {
        defaultExportBody.insertBefore(defineEmit)
      }
    }
  })
}

const transformSetup: ASTTransformation = (context) => {
  const { root, j } = context

  const defaultExportBody = root.find(j.ExportDefaultDeclaration)
  if (!defaultExportBody.length) return

  const defineComponent = defaultExportBody.find(j.CallExpression, {
    callee: { type: 'Identifier', name: 'defineComponent' }
  })
  if(!defineComponent.length) return

  // how to insert empty line?
  const body = defaultExportBody
    .find(j.ObjectMethod, node => node.key.name === 'setup')
    .find(j.BlockStatement).nodes()[0]?.body ?? []
  body
    .filter(node => !j.ReturnStatement.check(node))
    .forEach(node => defaultExportBody.insertBefore(node))
}

export const transformAST: ASTTransformation = context => {
  const cntFunc = getCntFunc('script-setup', global.outputReport)

  const { root, j, filename } = context

  if (filename && filename.endsWith('.vue')) {
    const defaultExportBody = root.find(j.ExportDefaultDeclaration)
    if (!defaultExportBody.length) return

    transformComponent(context)
    transformProps(context)
    transformEmit(context)
    transformSetup(context)

    defaultExportBody.remove()
    removeExtraneousImport(context, { localBinding: 'defineComponent' })

    cntFunc()
  }
}

export default wrap(transformAST)
export const parser = 'babylon'
