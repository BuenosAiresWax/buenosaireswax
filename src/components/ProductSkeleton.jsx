// src/components/ProductSkeleton.jsx
const ProductSkeleton = () => {
    return (
        <div className="product-card skeleton-card" aria-hidden="true">
            <div className="image skeleton-media" />

            <div className="info">
                <div className="itemTitleContainer">
                    <div className="skeleton-line skeleton-title" />
                    <div className="skeleton-circle" />
                </div>

                <div className="skeleton-line skeleton-author" />
                <div className="skeleton-line skeleton-price" />

                <div className="description-container">
                    <div className="skeleton-line skeleton-description" />
                    <div className="skeleton-line skeleton-description short" />
                </div>

                <div className="skeleton-line skeleton-label" />

                <div className="product-actions">
                    <div className="skeleton-action" />
                    <div className="skeleton-action" />
                </div>

                <div className="skeleton-line skeleton-stock" />
            </div>

            <div className="skeleton-faq" />
        </div>
    );
};

export default ProductSkeleton;
