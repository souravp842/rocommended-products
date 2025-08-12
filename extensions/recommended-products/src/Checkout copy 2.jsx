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

export default reactExtension("purchase.checkout.cart-line-list.render-after", () => <App />);

function App() {
  const { query, i18n } = useApi();
  const applyCartLinesChange = useApplyCartLinesChange();
  const lines = useCartLines();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingVariantId, setAddingVariantId] = useState(null);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (lines.length === 0) return;

    const lastLine = lines[0];
    const productId = lastLine.merchandise?.product?.id;
   // console.log(lastLine)

    if (productId) {
      fetchRecommendedProductIds(productId);
    }
  }, [lines]);

  useEffect(() => {
    if (showError) {
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showError]);

  async function fetchRecommendedProductIds(productId) {
    setLoading(true);
    try {
      const { data } = await query(
        `query getMetafield($id: ID!) {
          product(id: $id) {
            metafield(namespace: "shopify--discovery--product_recommendation", key: "complementary_products") {
              value
            }
          }
        }`,
        { variables: { id: productId } }
      );

      const metafield = data?.product?.metafield;
      //console.log(metafield)

      if (!metafield?.value) {
        setLoading(false);
        return;
      }

      const productIds = JSON.parse(metafield.value);
      await fetchRecommendedProducts(productIds);
    } catch (error) {
      console.error("Error fetching metafield:", error);
      setLoading(false);
    }
  }

  async function fetchRecommendedProducts(productIds) {
    try {
      const { data } = await query(
        `query getProductsByIds($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
              images(first: 1) {
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
        { variables: { ids: productIds } }
      );

     // console.log(data,'data')
      const inStockProducts = data.nodes.filter(
        (product) => product?.variants?.nodes[0]?.availableForSale
      );

      setProducts(inStockProducts);
    } catch (error) {
      console.error("Error fetching recommended products:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCart(variantId) {
    setAddingVariantId(variantId);
    const result = await applyCartLinesChange({
      type: "addCartLine",
      merchandiseId: variantId,
      quantity: 1,
    });
    setAddingVariantId(null);
    if (result.type === "error") {
      setShowError(true);
      console.error(result.message);
    }
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!loading && products.length === 0) {
    return null;
  }

  const cartVariantIds = lines.map((line) => line.merchandise.id);
  const productsOnOffer = products.filter(
    (product) =>
      !product.variants.nodes.some((variant) => cartVariantIds.includes(variant.id))
  );

  if (!productsOnOffer.length) {
    return null;
  }

  return (
    <BlockStack spacing="loose">
      <Divider />
      <Heading level={2}>You might also like</Heading>
      <BlockStack spacing="loose">
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
    <BlockStack spacing="loose">
      <Divider />
      <Heading level={2}>You might also like</Heading>
      <BlockStack spacing="loose">
        <InlineLayout spacing="base" columns={[64, "fill", "auto"]} blockAlignment="center">
          <SkeletonImage aspectRatio={1} />
          <BlockStack spacing="none">
            <SkeletonText inlineSize="large" />
            <SkeletonText inlineSize="small" />
          </BlockStack>
          <Button kind="secondary" disabled>
            Add
          </Button>
        </InlineLayout>
      </BlockStack>
    </BlockStack>
  );
}

function ProductOffer({ product, i18n, adding, handleAddToCart }) {
  const { images, title, variants } = product;
  const renderPrice = i18n.formatCurrency(variants.nodes[0].price.amount);
  const imageUrl =
    images.nodes[0]?.url ??
    "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png?format=webp&v=1530129081";

  return (
    <InlineLayout spacing="base" columns={[64, "fill", "auto"]} blockAlignment="center">
      <Image
        border="base"
        borderWidth="base"
        borderRadius="loose"
        source={imageUrl}
        accessibilityDescription={title}
        aspectRatio={1}
      />
      <BlockStack spacing="none">
        <Text size="medium" emphasis="bold">
          {title}
        </Text>
        <Text appearance="subdued">{renderPrice}</Text>
      </BlockStack>
      <Button
        kind="secondary"
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
    <Banner status="critical">
      There was an issue adding this product. Please try again.
    </Banner>
  );
}
