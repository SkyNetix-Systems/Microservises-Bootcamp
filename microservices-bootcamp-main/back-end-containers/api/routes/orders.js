import { Statement, InsertItem } from '/opt/nodejs/dynamoDB.mjs'
import { PromiseHandler } from '/opt/nodejs/Utils.mjs'
import { validateObject } from '/opt/nodejs/ObjectValidation/index.mjs'
import { BadProductIDError, InvalidQuantityError } from '/opt/nodejs/Errors.mjs'
import { authFunction } from '../auth.js'

import express from 'express'
const router = express.Router()
router.use(authFunction)

const state_map = {
  needs_picked: 'In Progress',
  staged: 'Ready For Pickup',
  complete: 'Complete',
  cancelled: 'Cancelled'
}

const cancellable_states = [
  'needs_picked',
  'staged'
]

router.get('/', async (req,res) => {
  const response = Statement(`SELECT state, date_created, id, customer FROM orders WHERE customer='${req.user_id}'`)

  await PromiseHandler(response.then(data => {
    data = data.map(item => {
      item.state = state_map[item.state]
      return item
    })
    return data
  }), res)
})

router.get('/:id', async (req,res) => {
  const response = Statement(`SELECT state, date_created, id, goods_ordered FROM orders WHERE id='${req.params.id}'`)

  await PromiseHandler(response.then(data => {
    data = data.map(item => {
      item.state = state_map[item.state]
      return item
    })
    return data[0]
  }), res)
})

router.post('/', async (req, res) => {
  const body = req.body
  const date_now = new Date()

  const defined_data = {
    state: 'needs_picked',
    staging_location: 'none',
    date_created: date_now.toISOString(),
    customer: req.user_id
  }

  const data = { ...body, ...defined_data }
  const validation_data = validateObject({
    schema: 'orders',
    object: data
  })

  if ( validation_data.length > 0) {
    res.status(400).json({ errors: validation_data })
  }

  try {
    await updateProducts({ goods_ordered: data.goods_ordered })
  } catch (error) {
    if (['InvalidQuantityError','BadProductIDError'].includes(error.name)) {
      res.status(400).json({ msg: error.message })
      return
    } else {
      console.error(error)
      res.status(500).json({ msg: 'Internal Service Error' })
      return
    }
  }

  await PromiseHandler(InsertItem({
    TableName: 'orders',
    data
  }), res)

})

router.delete('/:id', async (req, res) => {
  try {
    const order = await Statement(`SELECT goods_ordered, state, customer FROM orders WHERE id='${req.params.id}'`)
      .then(orders => orders[0])

    if (! cancellable_states.includes(order.state)) {
      res.status(400).json({ msg: `Can't cancel order in state ${state_map[order.state]}` })
      return
    }

    if (order.customer !== req.user_id) {
      res.status(404).json({ msg: `Can't access info for order ${req.params.id}` })
      return
    }

    await updateProducts({ goods_ordered: order.goods_ordered, operation: 'add' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: 'Internal Service Error' })
    return
  }

  await PromiseHandler(
    Statement('UPDATE orders SET state=? SET staging_location=? WHERE id=?',
      ['cancelled', 'none', req.params.id]),
    res
  )
})

const updateProducts = async ({ goods_ordered, operation = 'subtract' }) => {
  // get products
  const products = await Statement('SELECT id, in_stock FROM products')

  const order_quantities = []
  goods_ordered.forEach(item => {
    const product = products.find(p => p.id === item.product_id)

    // error if one of the IDs is not found
    if (product === undefined) {
      throw new BadProductIDError(`product with ID: ${item.product_id} not found`)
    }

    const index = order_quantities.findIndex(i => i.product_id === item.product_id)
    if (index === -1) {
      order_quantities.push({
        product_id: item.product_id,
        quantity: Number(item.quantity)
      })
    } else {
      order_quantities[index].quantity += item.quantity
    }
  })

  if ( operation === 'subtract' ) {
    // Ensure quantities are valid
    order_quantities.forEach(item => {
      const product = products.find(p => p.id === item.product_id)

      if (product.in_stock < item.quantity) {
        throw new InvalidQuantityError(`product ${item.product_id} in_stock less than ordered quantity`)
      }
    })
  }

  const operator = operation_map[operation]

  // update quantities in products table
  const promises = order_quantities.map(item => {
    return Statement(`UPDATE products SET in_stock = in_stock ${operator} ? WHERE id=?`,
      [item.quantity,item.product_id])
  })

  // await promise map of update statements
  return await Promise.all(promises)
  
}

const operation_map = {
  subtract: '-',
  add: '+'
}

export { router }