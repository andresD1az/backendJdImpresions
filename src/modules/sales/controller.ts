import { Request, Response } from 'express';

// Mock database
const sales: any[] = [];
const products: any[] = [
  { id: 1, name: 'Product 1', price: 10, stock: 100 },
  { id: 2, name: 'Product 2', price: 20, stock: 50 },
  { id: 3, name: 'Product 3', price: 30, stock: 75 },
];
const customers: any[] = [
  { id: 1, name: 'Customer 1', email: 'customer1@example.com' },
];

export async function createSale(req: Request, res: Response) {
  try {
    const { customerId, products: saleProducts, paymentMethod, total, discount } = req.body;

    // Validate products array
    if (!saleProducts || saleProducts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Products are required',
      });
    }

    // Check stock availability
    for (const item of saleProducts) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return res.status(422).json({
          success: false,
          message: `Product ${item.productId} not found`,
        });
      }
      if (product.stock < item.quantity) {
        return res.status(422).json({
          success: false,
          message: `Insufficient stock for product ${item.productId}`,
        });
      }
    }

    // Update stock
    for (const item of saleProducts) {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        product.stock -= item.quantity;
      }
    }

    const newSale = {
      id: sales.length + 1,
      customerId,
      products: saleProducts,
      paymentMethod,
      total,
      discount: discount || 0,
      status: 'completed',
      paymentStatus: paymentMethod === 'credit_card' ? 'approved' : 'paid',
      createdAt: new Date().toISOString(),
    };

    sales.push(newSale);

    res.status(201).json(newSale);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function getSale(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const sale = sales.find((s) => s.id === parseInt(id));

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
    }

    res.json(sale);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function getSales(req: Request, res: Response) {
  try {
    res.json(sales);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function cancelSale(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const sale = sales.find((s) => s.id === parseInt(id));

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
    }

    sale.status = 'cancelled';

    // Restore stock
    for (const item of sale.products) {
      const product = products.find((p: any) => p.id === item.productId);
      if (product) {
        product.stock += item.quantity;
      }
    }

    res.json({
      success: true,
      message: 'Sale cancelled successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function getInvoice(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const sale = sales.find((s) => s.id === parseInt(id));

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
    }

    res.json({
      success: true,
      invoice: {
        saleId: sale.id,
        total: sale.total,
        date: sale.createdAt,
        items: sale.products,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function getProducts(req: Request, res: Response) {
  try {
    res.json(products);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function getProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const product = products.find((p) => p.id === parseInt(id));

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function getCustomerSales(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const customerSales = sales.filter((s) => s.customerId === parseInt(id));

    res.json(customerSales);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}
