import { useState } from "react";

import { Loader } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import { useAction, useMutation, useQuery } from "convex/react";

import { toast } from "@shared/components/Toast";

import { api } from "../../../convex/_generated/api";

export default function CreateOrderPage() {
  const orgResult = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = orgResult?.organization?._id;

  // Get products for selection
  const products = useQuery(api.inventory.list, orgId ? { orgId } : "skip");

  // Mutations
  const createOrder = useMutation(api.orders.create);
  const extractOrderData = useAction(api.agents.extractionAgent.extractOrderFromChat);

  // Form state
  const [chatLog, setChatLog] = useState("");
  const [extracting, setExtracting] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientCity, setRecipientCity] = useState("");
  const [recipientProvince, setRecipientProvince] = useState("");
  const [recipientPostalCode, setRecipientPostalCode] = useState("");
  const [recipientCountry, setRecipientCountry] = useState("US");

  const [selectedProducts, setSelectedProducts] = useState<
    Array<{
      productId: string;
      quantity: number;
    }>
  >([]);

  const [notes, setNotes] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Extract order data from chat log
  const handleExtractFromChat = async () => {
    if (!chatLog.trim()) {
      toast.warning("Please paste a chat log first");
      return;
    }

    if (!orgId) {
      toast.error("Organization not found");
      return;
    }

    setExtracting(true);
    try {
      const result = await extractOrderData({
        chatText: chatLog.trim(),
      });

      if (result.success) {
        // Auto-fill form fields from extracted data
        const data = result.data;

        if (data.customerName) setCustomerName(data.customerName);
        if (data.customerPhone) setCustomerPhone(data.customerPhone);
        if (data.customerEmail) setCustomerEmail(data.customerEmail);

        if (data.recipientName) setRecipientName(data.recipientName);
        if (data.recipientPhone) setRecipientPhone(data.recipientPhone);
        if (data.recipientAddress) setRecipientAddress(data.recipientAddress);
        if (data.recipientCity) setRecipientCity(data.recipientCity);
        if (data.recipientProvince) setRecipientProvince(data.recipientProvince);
        if (data.recipientPostalCode) setRecipientPostalCode(data.recipientPostalCode);
        if (data.recipientCountry) setRecipientCountry(data.recipientCountry);

        // Set items
        if (data.items && data.items.length > 0) {
          const mappedItems = data.items
            .map((item: any) => {
              // Find product by SKU or name
              const product = (products as any[])?.find(
                (p) => p.sku === item.sku || p.name.toLowerCase().includes(item.productName?.toLowerCase()),
              );

              if (product) {
                return {
                  productId: product._id,
                  quantity: item.quantity || 1,
                };
              }
              return null;
            })
            .filter(Boolean);

          setSelectedProducts(mappedItems as any);
        }

        if (data.notes) setNotes(data.notes);
        if (data.specialInstructions) setSpecialInstructions(data.specialInstructions);

        toast.success("Order data extracted successfully!");
      } else {
        toast.error("Failed to extract order data. Please fill manually.");
      }
    } catch (error: any) {
      console.error("Extraction error:", error);
      toast.error(error?.message || "Failed to extract data");
    } finally {
      setExtracting(false);
    }
  };

  // Add product to order
  const handleAddProduct = () => {
    setSelectedProducts([...selectedProducts, { productId: "", quantity: 1 }]);
  };

  const handleRemoveProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, field: "productId" | "quantity", value: any) => {
    const updated = [...selectedProducts];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedProducts(updated);
  };

  // Submit order
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orgId) {
      toast.error("Organization not found");
      return;
    }

    // Validation
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    if (!recipientName.trim() || !recipientAddress.trim() || !recipientCity.trim()) {
      toast.error("Recipient details are required");
      return;
    }

    if (selectedProducts.length === 0 || selectedProducts.some((p) => !p.productId)) {
      toast.error("Please select at least one product");
      return;
    }

    setSubmitting(true);
    try {
      // Prepare items with product details
      const items = selectedProducts.map((sp) => {
        const product = (products as any[])?.find((p) => p._id === sp.productId);
        return {
          productId: sp.productId as any,
          sku: product?.sku || "",
          productName: product?.name || "",
          quantity: sp.quantity,
          unitPrice: product?.sellPrice || 0,
          unitCost: product?.costOfGoods || 0,
        };
      });

      await createOrder({
        orgId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        recipientAddress: recipientAddress.trim(),
        recipientCity: recipientCity.trim(),
        recipientProvince: recipientProvince.trim(),
        recipientPostalCode: recipientPostalCode.trim(),
        recipientCountry: recipientCountry.trim(),
        items,
        rawChatLog: chatLog.trim() || undefined,
        notes: notes.trim() || undefined,
        specialInstructions: specialInstructions.trim() || undefined,
      } as any);

      toast.success("Order created successfully!");

      // Reset form
      setChatLog("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setRecipientName("");
      setRecipientPhone("");
      setRecipientAddress("");
      setRecipientCity("");
      setRecipientProvince("");
      setRecipientPostalCode("");
      setRecipientCountry("US");
      setSelectedProducts([]);
      setNotes("");
      setSpecialInstructions("");
    } catch (error: any) {
      console.error("Create order error:", error);
      toast.error(error?.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  if (orgResult === undefined || products === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader size="xl" type="dots" />
      </div>
    );
  }

  if (!orgId) {
    return <div className="min-h-screen bg-black p-6 text-sm text-neutral-400">Organization not found.</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs tracking-[0.4em] text-neutral-400 uppercase">Create Order</p>
            <h1 className="text-2xl font-semibold">New Order</h1>
          </div>
          <a
            href="/orders"
            className="border border-white/40 px-4 py-1.5 text-xs font-semibold tracking-[0.2em] uppercase transition hover:bg-white hover:text-black"
          >
            Back to Orders
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* AI Chat Extraction */}
        <div className="mb-8 border border-white/10 bg-black/40">
          <div className="border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4">
            <div className="flex items-center gap-2">
              <IconSparkles className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold">AI Order Extraction</h2>
            </div>
            <p className="mt-1 text-sm text-neutral-400">
              Paste your customer chat conversation and let AI extract the order details automatically.
            </p>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <label htmlFor="chat-log" className="mb-2 block text-sm font-medium">
                Chat Conversation
              </label>
              <textarea
                id="chat-log"
                value={chatLog}
                onChange={(e) => setChatLog(e.target.value)}
                placeholder="Paste your WhatsApp, Instagram, or any chat conversation here..."
                rows={8}
                className="w-full border border-white/20 bg-black p-4 font-mono text-sm text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
              />
            </div>

            <button
              onClick={handleExtractFromChat}
              disabled={extracting || !chatLog.trim()}
              className="inline-flex items-center gap-2 border border-purple-500/40 bg-purple-500/10 px-6 py-2 text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
            >
              {extracting ? (
                <>
                  <Loader size="sm" />
                  Extracting...
                </>
              ) : (
                <>
                  <IconSparkles className="h-4 w-4" />
                  Extract Order Data
                </>
              )}
            </button>
          </div>
        </div>

        {/* Order Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="border border-white/10 bg-black/40">
            <div className="border-b border-white/10 p-4">
              <h2 className="text-lg font-semibold">Customer Information</h2>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-3">
              <div>
                <label htmlFor="customer-name" className="mb-2 block text-sm font-medium">
                  Name *
                </label>
                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="customer-phone" className="mb-2 block text-sm font-medium">
                  Phone
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="customer-email" className="mb-2 block text-sm font-medium">
                  Email
                </label>
                <input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="border border-white/10 bg-black/40">
            <div className="border-b border-white/10 p-4">
              <h2 className="text-lg font-semibold">Shipping Address</h2>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label htmlFor="recipient-name" className="mb-2 block text-sm font-medium">
                  Recipient Name *
                </label>
                <input
                  id="recipient-name"
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="recipient-phone" className="mb-2 block text-sm font-medium">
                  Phone *
                </label>
                <input
                  id="recipient-phone"
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  required
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="recipient-address" className="mb-2 block text-sm font-medium">
                  Street Address *
                </label>
                <input
                  id="recipient-address"
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  required
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="recipient-city" className="mb-2 block text-sm font-medium">
                  City *
                </label>
                <input
                  id="recipient-city"
                  type="text"
                  value={recipientCity}
                  onChange={(e) => setRecipientCity(e.target.value)}
                  required
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="recipient-province" className="mb-2 block text-sm font-medium">
                  State/Province *
                </label>
                <input
                  id="recipient-province"
                  type="text"
                  value={recipientProvince}
                  onChange={(e) => setRecipientProvince(e.target.value)}
                  required
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="recipient-postal" className="mb-2 block text-sm font-medium">
                  Postal Code *
                </label>
                <input
                  id="recipient-postal"
                  type="text"
                  value={recipientPostalCode}
                  onChange={(e) => setRecipientPostalCode(e.target.value)}
                  required
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="recipient-country" className="mb-2 block text-sm font-medium">
                  Country *
                </label>
                <input
                  id="recipient-country"
                  type="text"
                  value={recipientCountry}
                  onChange={(e) => setRecipientCountry(e.target.value)}
                  required
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="border border-white/10 bg-black/40">
            <div className="border-b border-white/10 p-4">
              <h2 className="text-lg font-semibold">Order Items</h2>
            </div>
            <div className="p-6">
              {selectedProducts.map((item, index) => (
                <div key={index} className="mb-4 grid gap-4 border-b border-white/10 pb-4 last:border-b-0 md:grid-cols-12">
                  <div className="md:col-span-8">
                    <label htmlFor={`product-${index}`} className="mb-2 block text-sm font-medium">
                      Product *
                    </label>
                    <select
                      id={`product-${index}`}
                      value={item.productId}
                      onChange={(e) => handleProductChange(index, "productId", e.target.value)}
                      required
                      className="w-full border border-white/20 bg-black p-2 text-white focus:border-white/40 focus:outline-none"
                    >
                      <option value="">Select a product</option>
                      {(products as any[])?.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.sku} - {p.name} (Stock: {p.stockQuantity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label htmlFor={`quantity-${index}`} className="mb-2 block text-sm font-medium">
                      Quantity *
                    </label>
                    <input
                      id={`quantity-${index}`}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleProductChange(index, "quantity", Number.parseInt(e.target.value, 10) || 1)}
                      required
                      className="w-full border border-white/20 bg-black p-2 text-white focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-1 md:pt-7">
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(index)}
                      className="border border-red-400 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddProduct}
                className="border border-white/40 px-4 py-2 text-sm hover:bg-white hover:text-black"
              >
                + Add Product
              </button>
            </div>
          </div>

          {/* Additional Information */}
          <div className="border border-white/10 bg-black/40">
            <div className="border-b border-white/10 p-4">
              <h2 className="text-lg font-semibold">Additional Information</h2>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label htmlFor="special-instructions" className="mb-2 block text-sm font-medium">
                  Special Instructions
                </label>
                <textarea
                  id="special-instructions"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={4}
                  placeholder="Any special packaging or handling instructions..."
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="notes" className="mb-2 block text-sm font-medium">
                  Internal Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Notes for staff (not visible to customer)..."
                  className="w-full border border-white/20 bg-black p-2 text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <a href="/orders" className="border border-white/40 px-6 py-2 transition hover:bg-white/10">
              Cancel
            </a>
            <button
              type="submit"
              disabled={submitting}
              className="border border-white/40 bg-white px-6 py-2 text-black transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader size="sm" />
                  Creating...
                </>
              ) : (
                "Create Order"
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
