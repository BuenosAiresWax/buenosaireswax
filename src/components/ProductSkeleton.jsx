// src/components/ProductSkeleton.jsx
const ProductSkeleton = () => {
    return (
        <div className="product-item skeleton">
            <div className="image skeleton-box" />
            <div className="info">
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
                <div className="skeleton-line" />
            </div>
            <div className="cta">
                <div className="skeleton-button" />
            </div>
        </div>
    );
};

export default ProductSkeleton;
