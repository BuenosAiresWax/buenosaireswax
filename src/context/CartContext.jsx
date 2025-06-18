// src/context/CartContext.js
import { createContext, useState, useEffect } from "react";

export const CartContext = createContext();

export function CartProvider({ children }) {
    const [cartItems, setCartItems] = useState(() => {
        const stored = localStorage.getItem("cart");
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        localStorage.setItem("cart", JSON.stringify(cartItems));
    }, [cartItems]);

    const addToCart = (producto) => {
        setCartItems(prev => {
            const existing = prev.find(item => item.id === producto.id);
            if (existing) {
                return prev.map(item =>
                    item.id === producto.id
                        ? { ...item, cantidad: item.cantidad + 1 }
                        : item
                );
            }
            return [...prev, { ...producto, cantidad: 1 }];
        });
    };

    const removeFromCart = (productId) => {
        setCartItems(prevItems => {
            const item = prevItems.find(item => item.id === productId);
            if (item && item.cantidad > 1) {
                // Resta 1 unidad
                return prevItems.map(item =>
                    item.id === productId ? { ...item, cantidad: item.cantidad - 1 } : item
                );
            } else {
                // Elimina completamente si solo queda una
                return prevItems.filter(item => item.id !== productId);
            }
        });
    };

    const clearCart = () => setCartItems([]);

    const getTotalQuantity = () =>
        cartItems.reduce((total, item) => total + item.cantidad, 0);

    return (
        <CartContext.Provider value={{
            cartItems,
            addToCart,
            removeFromCart,
            clearCart,
            getTotalQuantity
        }}>
            {children}
        </CartContext.Provider>
    );
}
