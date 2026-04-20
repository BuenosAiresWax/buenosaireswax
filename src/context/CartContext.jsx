// src/context/CartContext.js
import { createContext, useState, useEffect } from "react";
import { getCartItemKey, getProductCollectionName } from "../utils/catalog";

export const CartContext = createContext();

const hydrateCartItems = (items = []) =>
    items.map((item) => {
        const collectionName = getProductCollectionName(item);

        return {
            ...item,
            collectionName,
            cartKey: `${collectionName}:${item.id}`,
        };
    });

export function CartProvider({ children }) {
    const [cartItems, setCartItems] = useState(() => {
        const stored = localStorage.getItem("cart");
        return stored ? hydrateCartItems(JSON.parse(stored)) : [];
    });

    useEffect(() => {
        localStorage.setItem("cart", JSON.stringify(cartItems));
    }, [cartItems]);

    const addToCart = (producto) => {
        const collectionName = getProductCollectionName(producto);
        const cartKey = getCartItemKey(producto);
        const productWithMeta = {
            ...producto,
            collectionName,
            cartKey,
        };

        setCartItems(prev => {
            const existing = prev.find(item => getCartItemKey(item) === cartKey);
            if (existing) {
                return prev.map(item =>
                    getCartItemKey(item) === cartKey
                        ? { ...item, cantidad: item.cantidad + 1 }
                        : item
                );
            }
            return [...prev, { ...productWithMeta, cantidad: 1 }];
        });
    };

    const removeFromCart = (producto) => {
        const cartKey = typeof producto === "string"
            ? `productos:${producto}`
            : getCartItemKey(producto);

        setCartItems(prevItems => {
            const item = prevItems.find(item => getCartItemKey(item) === cartKey);
            if (item && item.cantidad > 1) {
                return prevItems.map(item =>
                    getCartItemKey(item) === cartKey
                        ? { ...item, cantidad: item.cantidad - 1 }
                        : item
                );
            } else {
                return prevItems.filter(item => getCartItemKey(item) !== cartKey);
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
