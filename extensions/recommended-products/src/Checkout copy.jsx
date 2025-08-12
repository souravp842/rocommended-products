import React, { useEffect, useState } from "react";
import {
  reactExtension,
  Divider,
  Image,
  Banner,
  Heading,
  Button,
  InlineLayout,
  BlockStack,
  Text,
  SkeletonText,
  SkeletonImage,
  useCartLines,
  useApplyCartLinesChange,
  useApi,
} from "@shopify/ui-extensions-react/checkout";
// Set up the entry point for the extension
export default reactExtension("purchase.checkout.cart-line-list.render-after", () => <App />);

function App() {
  const { query, i18n } = useApi();
  const applyCartLinesChange = useApplyCartLinesChange();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingVariantId, setAddingVariantId] = useState(null);
  const [showError, setShowError] = useState(false);
  const lines = useCartLines();

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (showError) {
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showError]);

    async function handleAddToCart(variantId) {
      setAddingVariantId(variantId);
      const result = await applyCartLinesChange({
        type: 'addCartLine',
        merchandiseId: variantId,
        quantity: 1,
      });
       setAddingVariantId(null);
      if (result.type === 'error') {
        setShowError(true);
        console.error(result.message);
      }
    }

async function fetchProducts() {
  setLoading(true);
  try {
    const {data} = await query(
      `query ($first: Int!) {
        products(first: $first) {
          nodes {
            id
            title
            metafield(namespace: "shopify--discovery--product_recommendation", key: "complementary_products") {
              id
              namespace
              key
              value
            }
            images(first:1){
              nodes {
                url
              }
            }
            variants(first: 1) {
              nodes {
                id
                availableForSale
                price {
                  amount
                }
              }
            }
          }
        }
      }`,
      {
        variables: { first: 10 },
      }
    );

    console.log("GraphQL response:", data); // 👈 Inspect structure here

    // Only include products where the first variant is available for sale
    const inStockProducts = data.products.nodes.filter((product) =>
      product.variants.nodes[0]?.availableForSale
    );

    setProducts(inStockProducts);
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
}


  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!loading && products.length === 0) {
    return null;
  }

  const productsOnOffer = getProductsOnOffer(lines, products);

  if (!productsOnOffer.length) {
    return null;
  }

  return (
    <BlockStack spacing='loose'>
  <Divider />
  <Heading level={2}>You might also like</Heading>
  <BlockStack spacing='loose'>
    {productsOnOffer.slice(0, 3).map((product) => (
      <ProductOffer
        key={product.id}
        product={product}
        i18n={i18n}
        adding={addingVariantId === product.variants.nodes[0].id}
        handleAddToCart={handleAddToCart}
      />
    ))}
    {showError && <ErrorBanner />}
  </BlockStack>
</BlockStack>
  );
}

function LoadingSkeleton() {
  return (
    <BlockStack spacing='loose'>
      <Divider />
      <Heading level={2}>You might also like</Heading>
      <BlockStack spacing='loose'>
        <InlineLayout
          spacing='base'
          columns={[64, 'fill', 'auto']}
          blockAlignment='center'
        >
          <SkeletonImage aspectRatio={1} />
          <BlockStack spacing='none'>
            <SkeletonText inlineSize='large' />
            <SkeletonText inlineSize='small' />
          </BlockStack>
          <Button kind='secondary' disabled={true}>
            Add
          </Button>
        </InlineLayout>
      </BlockStack>
    </BlockStack>
  );
}

function getProductsOnOffer(lines, products) {
  const cartLineProductVariantIds = lines.map((item) => item.merchandise.id);
  return products.filter((product) => {
    const isProductVariantInCart = product.variants.nodes.some(({ id }) =>
      cartLineProductVariantIds.includes(id)
    );
    return !isProductVariantInCart;
  });
}

function ProductOffer({ product, i18n, adding, handleAddToCart }) {
  const { images, title, variants } = product;
  const renderPrice = i18n.formatCurrency(variants.nodes[0].price.amount);
  const imageUrl =
    images.nodes[0]?.url ??
    'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png?format=webp&v=1530129081';

  return (
    <InlineLayout
      spacing='base'
      columns={[64, 'fill', 'auto']}
      blockAlignment='center'
    >
      <Image
        border='base'
        borderWidth='base'
        borderRadius='loose'
        source={imageUrl}
        accessibilityDescription={title}
        aspectRatio={1}
      />
      <BlockStack spacing='none'>
        <Text size='medium' emphasis='bold'>
          {title}
        </Text>
        <Text appearance='subdued'>{renderPrice}</Text>
      </BlockStack>
      <Button
        kind='secondary'
        loading={adding}
        accessibilityLabel={`Add ${title} to cart`}
        onPress={() => handleAddToCart(variants.nodes[0].id)}
      >
        Add
      </Button>
    </InlineLayout>
  );
}


function ErrorBanner() {
  return (
    <Banner status='critical'>
      There was an issue adding this product. Please try again.
    </Banner>
  );
}
