import wrap from '../src/wrapAstTransformation'
import type { ASTTransformation } from '../src/wrapAstTransformation'
import { getCntFunc } from '../src/report'
import type * as N from 'jscodeshift'

type PropDefinition = {
  key: string;
  type: N.TSTypeAnnotation;
  required: boolean | null;
  defaultValue?: N.Literal | N.Expression;
}

const transformProps: ASTTransformation = (context) => {
  const { root, j } = context
  const cntFunc = getCntFunc('defineProps', global.outputReport)

  const defaultExportBody = root.find(j.ExportDefaultDeclaration)
  if (!defaultExportBody.length) return

  const defineProps = defaultExportBody.find(j.CallExpression, {
    callee: {
      type: 'N.Identifier',
      name: 'defineProps',
    }
  })
  if(!defineProps.length) return

  const getTsTypeAnnotation = (
    type: N.TSTypeReference
    | N.TSType
    | N.Identifier
    | string[]
    | string
    | null
    | undefined
  ): N.TSTypeAnnotation => {
    const typeMapping: Record<string, any> = {
      String: j.tsStringKeyword(),
      Number: j.tsNumberKeyword(),
      Boolean: j.tsBooleanKeyword(),
      Array: j.tsArrayType(j.tsAnyKeyword()),
      Object: j.tsObjectKeyword(),
      Date: j.tsTypeReference(j.identifier('Date')),
      Function: j.tsTypeReference(j.identifier('Function')),
      Symbol: j.tsTypeReference(j.identifier('Symbol')),
    }

    if(j.TSTypeReference.check(type)) {
      return j.tsTypeAnnotation(type)
    }

    if(j.TSType.check(type)) {
      // @ts-ignore
      return j.tsTypeAnnotation(type)
    }

    if(j.Identifier.check(type)) {
      return j.tsTypeAnnotation(j.tsTypeReference(type))
    }

    if(Array.isArray(type)) {
      return j.tsTypeAnnotation(j.tsUnionType(type.map(t => typeMapping[t] || j.tsTypeReference(j.identifier(t)))))
    }


    if(typeof type === 'string') {
      return j.tsTypeAnnotation(typeMapping[type] || j.tsTypeReference(j.identifier(type)))
    }

    return j.tsTypeAnnotation(j.tsUnknownKeyword())
  }

  const propsArray: PropDefinition[] = []

  const propsProperty = defaultExportBody.find(j.ObjectProperty, { key: { name: 'props' } }).at(0)
  if(!propsProperty.length) return

  const propsCollections = defaultExportBody
    .find(j.ObjectProperty, { key: { name: 'props' } })
    .filter(node => node.parent.parent.parent.node.type === 'ExportDefaultDeclaration')
  const propsKeys = [...new Set(propsCollections
    .find(j.Identifier)
    .filter(node => node.parent.parent.parent.node.key?.name === 'props')
    .paths()
    .map(path => path.parent.node.key.name))]
  // console.log(propsKeys)

  propsKeys.forEach(key => {
    const prop = propsCollections
      .find(j.ObjectProperty, { key: { name: key } })
      .get(0).node as N.ObjectProperty

    // Basic type
    // propsKey: Number | String | ...
    if(j.Identifier.check(prop.value)) {
      propsArray.push({
        key,
        type: getTsTypeAnnotation(prop.value),
        required: null,
      })
      return
    }

    // propsKey: [Number, String, ...]
    if(j.ArrayExpression.check(prop.value)) {
      const arrayItems = prop.value.elements.filter(e => j.Identifier.check(e)) as N.Identifier[]
      propsArray.push({
        key,
        type: getTsTypeAnnotation(arrayItems.map(e => e.name)),
        required: false,
      })
      return
    }

    // Object definition
    // propsKey: { type: ..., default?: ..., required?: ... }
    if(j.ObjectExpression.check(prop.value)) {
      const properties = prop.value.properties
      const propType = properties.find((node: any) => node.key.name === 'type') as N.ObjectProperty
      const defaultValueNode = (properties.find((property: any) => property.key.name === 'default') as N.ObjectProperty)?.value
      const requiredNode = (properties.find((property: any) => property.key.name === 'required' && j.BooleanLiteral.check(property.value)) as N.ObjectProperty)
      const required = requiredNode ? (requiredNode.value as N.BooleanLiteral).value : null

      const propDefault = defaultValueNode
        ? j.ArrowFunctionExpression.check(defaultValueNode)
          ? defaultValueNode
          : j.Literal.check(defaultValueNode.type)
            ? (defaultValueNode as N.NumericLiteral)?.value || null
            : null
        : null

      // Simple constructor type
      // propsKey: { type: Number | String | ... }
      if(j.Identifier.check(propType.value)) {
        // console.log(propKey, propType.value.name, getTsTypeAnnotation(propType.value.name))
        propsArray.push({
          key,
          type: getTsTypeAnnotation(propType.value.name),
          required,
          // @ts-ignore
          defaultValue: propDefault,
        })
        return
      }

      // Typescript type casting
      // propsKey: { type: Object as PropType<T> }
      if(j.TSAsExpression.check(propType.value)) {
        const tsAsExpression = propType.value
        const typeBeforeCast = j.Identifier.check(tsAsExpression.expression)
          ? tsAsExpression.expression.name
          : null
        // handle "as T" & "as PropType<T>"
        const typeAfterCast = j.TSTypeReference.check(tsAsExpression.typeAnnotation)
          ? (tsAsExpression.typeAnnotation.typeName as N.Identifier).name === 'PropType'
            ? tsAsExpression.typeAnnotation.typeParameters?.params[0]
            : (tsAsExpression.typeAnnotation.typeName as N.Identifier)
          : null

        propsArray.push({
          key: key,
          type: getTsTypeAnnotation(typeAfterCast || typeBeforeCast),
          required,
          // @ts-ignore
          defaultValue: propDefault,
        })
        return
      }
    }
  })

  if (propsArray.length > 0) {
    const propsTypeDeclaration = j.tsTypeAliasDeclaration(
      j.identifier('Props'),
      j.tsTypeLiteral(
        propsArray.map(prop => {
            const required = prop.required === true ? true : 'defaultValue' in prop
            return j.tsPropertySignature(
              j.identifier(prop.key),
              prop.type,
              !required,
            );
        })
      )
    )
    defaultExportBody.insertBefore(propsTypeDeclaration)

    const defineProps = j.callExpression(j.identifier('defineProps'), [])
    // @ts-ignore
    defineProps.typeArguments = j.tsTypeParameterInstantiation([
      j.tsTypeReference(j.identifier('Props')),
    ])
    const props = j.variableDeclaration('const', [
      j.variableDeclarator(j.identifier('props'), defineProps)
    ])
    defaultExportBody.insertBefore(props)

    cntFunc()
  }
}

export const transformAST: ASTTransformation = context => {
  const { filename } = context

  if (filename && filename.endsWith('.vue')) {
    transformProps(context)
  }
}

export default wrap(transformAST)
export const parser = 'babylon'
