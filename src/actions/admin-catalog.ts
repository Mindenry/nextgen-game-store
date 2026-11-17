"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { one, run, withTransaction } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { toMinor, toNumericString } from "@/lib/money";
import { saveUpload, UploadError } from "@/lib/uploads";
import { slugify } from "@/lib/utils";

export type AdminResult = { error?: string; success?: string; data?: unknown };

function s(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function nullable(fd: FormData, key: string): string | null {
  const value = s(fd, key);
  return value === "" ? null : value;
}
function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true" || fd.get(key) === "1";
}
function price(fd: FormData, key: string): string | null {
  const raw = s(fd, key);
  if (!raw) return null;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) throw new Error(`Invalid amount for ${key}`);
  return toNumericString(toMinor(raw));
}

async function guard(permission: string) {
  const user = await requireStaff();
  if (!can(user, permission)) throw new Error("You do not have permission to do that.");
  return user;
}

export async function saveCategoryAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.categoriesManage);
    const id = s(formData, "id");
    const nameEn = s(formData, "nameEn");
    const nameTh = s(formData, "nameTh");
    if (!nameEn || !nameTh) return { error: "Both English and Thai names are required." };
    const slug = slugify(s(formData, "slug") || nameEn);
    if (!slug) return { error: "Slug is invalid." };
    const values = [
      nameTh,
      nameEn,
      s(formData, "descriptionTh") || null,
      s(formData, "descriptionEn") || null,
      s(formData, "icon") || "Gamepad2",
      s(formData, "accent") || "violet",
      nullable(formData, "parentId"),
      Number(s(formData, "sortOrder") || 0),
      bool(formData, "isActive"),
    ];
    if (id) {
      await run(
        `update categories set name_th=$1, name_en=$2, description_th=$3, description_en=$4, icon=$5,
           accent=$6, parent_id=$7::uuid, sort_order=$8, is_active=$9, slug=$10, updated_at=now() where id=$11::uuid`,
        [...values, slug, id],
      );
      await audit({ actorId: user.id, actorEmail: user.email, action: "category.update", entityType: "category", entityId: id, after: { slug } });
    } else {
      const created = await one<{ id: string }>(
        `insert into categories(name_th,name_en,description_th,description_en,icon,accent,parent_id,sort_order,is_active,slug)
         values ($1,$2,$3,$4,$5,$6,$7::uuid,$8,$9,$10) returning id`,
        [...values, slug],
      );
      await audit({ actorId: user.id, actorEmail: user.email, action: "category.create", entityType: "category", entityId: created!.id, after: { slug } });
    }
    revalidatePath("/admin/categories");
    revalidatePath("/");
    return { success: "Category saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the category." };
  }
}

export async function deleteCategoryAction(id: string): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.categoriesManage);
    const used = await one<{ count: number }>("select count(*)::int as count from products where category_id = $1", [id]);
    if (Number(used?.count ?? 0) > 0) return { error: "Move or delete products in this category first." };
    await run("delete from categories where id = $1", [id]);
    await audit({ actorId: user.id, actorEmail: user.email, action: "category.delete", entityType: "category", entityId: id });
    revalidatePath("/admin/categories");
    return { success: "Category deleted." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not delete the category." };
  }
}

export async function saveProductAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.productsManage);
    const id = s(formData, "id");
    const nameEn = s(formData, "nameEn");
    const nameTh = s(formData, "nameTh");
    const categoryId = s(formData, "categoryId");
    if (!nameEn || !nameTh || !categoryId) return { error: "Name and category are required." };
    const slug = slugify(s(formData, "slug") || nameEn);
    const regularPrice = price(formData, "price");
    if (!regularPrice) return { error: "Price is required." };
    const compare = price(formData, "compareAtPrice");
    if (compare && toMinor(compare) < toMinor(regularPrice)) {
      return { error: "Compare-at price must be higher than the selling price." };
    }
    const stockMode = s(formData, "stockMode") || "inventory";
    const features = s(formData, "features")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20);
    const metadata = JSON.stringify({ features, source: s(formData, "source") || "store" });
    const base = [
      categoryId,
      nameTh,
      nameEn,
      s(formData, "shortDescription") || null,
      s(formData, "description") || null,
      s(formData, "productType") || "digital_key",
      regularPrice,
      compare,
      price(formData, "costPrice"),
      stockMode,
      Math.max(0, Number(s(formData, "stockQuantity") || 0)),
      s(formData, "badge") || null,
      bool(formData, "isActive"),
      bool(formData, "isFeatured"),
      s(formData, "deliveryMethod") || "auto",
      s(formData, "deliveryTime") || "Instant",
      s(formData, "terms") || null,
      Number(s(formData, "sortOrder") || 0),
      metadata,
    ];
    if (id) {
      await run(
        `update products set category_id=$1::uuid, name_th=$2, name_en=$3, short_description=$4, description=$5,
           product_type=$6, price=$7, compare_at_price=$8, cost_price=$9, stock_mode=$10, stock_quantity=$11,
           badge=$12, is_active=$13, is_featured=$14, delivery_method=$15, delivery_time=$16, terms=$17,
           sort_order=$18, metadata=$19::jsonb, slug=$20, updated_at=now()
         where id=$21::uuid`,
        [...base, slug, id],
      );
      await audit({ actorId: user.id, actorEmail: user.email, action: "product.update", entityType: "product", entityId: id, after: { slug, price: regularPrice } });
    } else {
      const created = await one<{ id: string }>(
        `insert into products(category_id,name_th,name_en,short_description,description,product_type,price,
           compare_at_price,cost_price,stock_mode,stock_quantity,badge,is_active,is_featured,delivery_method,
           delivery_time,terms,sort_order,metadata,slug)
         values ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)
         returning id`,
        [...base, slug],
      );
      await audit({ actorId: user.id, actorEmail: user.email, action: "product.create", entityType: "product", entityId: created!.id, after: { slug, price: regularPrice } });
    }
    revalidatePath("/admin/products");
    revalidatePath("/products");
    revalidatePath("/");
    return { success: "Product saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the product." };
  }
}

export async function deleteProductAction(id: string): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.productsManage);
    const sold = await one<{ count: number }>("select count(*)::int as count from order_items where product_id = $1", [id]);
    if (Number(sold?.count ?? 0) > 0) {
      await run("update products set is_active = false, is_featured = false where id = $1", [id]);
      await audit({ actorId: user.id, actorEmail: user.email, action: "product.soft_delete", entityType: "product", entityId: id });
      revalidatePath("/admin/products");
      return { success: "Product has order history, so it was deactivated instead of deleted." };
    }
    await run("delete from products where id = $1", [id]);
    await audit({ actorId: user.id, actorEmail: user.email, action: "product.delete", entityType: "product", entityId: id });
    revalidatePath("/admin/products");
    return { success: "Product deleted." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not delete the product." };
  }
}

export async function toggleProductAction(id: string, field: "is_active" | "is_featured"): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.productsManage);
    if (field !== "is_active" && field !== "is_featured") return { error: "Invalid field." };
    await run(`update products set ${field} = not ${field}, updated_at = now() where id = $1`, [id]);
    await audit({ actorId: user.id, actorEmail: user.email, action: `product.toggle_${field}`, entityType: "product", entityId: id });
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { success: "Product updated." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the product." };
  }
}

export async function duplicateProductAction(id: string): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.productsManage);
    const product = await one<Record<string, unknown>>("select * from products where id = $1", [id]);
    if (!product) return { error: "Product not found." };
    const newSlug = `${String(product.slug)}-copy-${randomUUID().slice(0, 4)}`;
    const copy = await one<{ id: string }>(
      `insert into products(category_id,name_th,name_en,short_description,description,product_type,price,
         compare_at_price,cost_price,stock_mode,stock_quantity,badge,is_active,is_featured,delivery_method,
         delivery_time,terms,sort_order,metadata,slug)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,false,$12,$13,$14,$15,$16,$17,$18)
       returning id`,
      [
        product.category_id,
        product.name_th,
        `${String(product.name_en)} (copy)`,
        product.short_description,
        product.description,
        product.product_type,
        product.price,
        product.compare_at_price,
        product.cost_price,
        product.stock_mode,
        product.badge,
        product.is_featured,
        product.delivery_method,
        product.delivery_time,
        product.terms,
        product.sort_order,
        JSON.stringify(product.metadata ?? {}),
        newSlug,
      ],
    );
    await run(
      `insert into product_variants(product_id,name_th,name_en,sku,price,compare_at_price,stock_quantity,sort_order,metadata)
       select $1, name_th, name_en, null, price, compare_at_price, 0, sort_order, metadata
       from product_variants where product_id = $2`,
      [copy!.id, id],
    );
    await run(
      `insert into product_images(product_id,url,alt,sort_order)
       select $1, url, alt, sort_order from product_images where product_id = $2`,
      [copy!.id, id],
    );
    await audit({ actorId: user.id, actorEmail: user.email, action: "product.duplicate", entityType: "product", entityId: copy!.id, after: { from: id } });
    revalidatePath("/admin/products");
    return { success: "Product duplicated." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not duplicate the product." };
  }
}

export async function addProductImageAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.productsManage);
    const productId = s(formData, "productId");
    if (!productId) return { error: "Product is required." };
    const urlField = s(formData, "imageUrl");
    let url = urlField;
    const file = formData.get("image");
    if (file instanceof File && file.size > 0) {
      url = await saveUpload({ file, folder: "products", ownerId: productId });
    }
    if (!url) return { error: "Upload an image or paste an image URL." };
    const order = await one<{ next: number }>(
      "select coalesce(max(sort_order), -1) + 1 as next from product_images where product_id = $1",
      [productId],
    );
    await run("insert into product_images(product_id,url,alt,sort_order) values ($1,$2,$3,$4)", [
      productId,
      url,
      s(formData, "alt") || null,
      Number(order?.next ?? 0),
    ]);
    await audit({ actorId: user.id, actorEmail: user.email, action: "product.image_add", entityType: "product", entityId: productId });
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/products");
    return { success: "Image added." };
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Could not add the image." };
  }
}

export async function deleteProductImageAction(imageId: string, productId: string): Promise<AdminResult> {
  try {
    await guard(PERMISSIONS.productsManage);
    await run("delete from product_images where id = $1 and product_id = $2", [imageId, productId]);
    revalidatePath(`/admin/products/${productId}`);
    return { success: "Image removed." };
  } catch (error) {
    return { error: "Could not remove the image." };
  }
}

export async function saveVariantAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    await guard(PERMISSIONS.productsManage);
    const productId = s(formData, "productId");
    const id = s(formData, "id");
    const nameEn = s(formData, "nameEn");
    const nameTh = s(formData, "nameTh");
    const regularPrice = price(formData, "price");
    if (!productId || !nameEn || !nameTh || !regularPrice) return { error: "Name and price are required." };
    const values = [nameTh, nameEn, regularPrice, price(formData, "compareAtPrice"), Math.max(0, Number(s(formData, "stockQuantity") || 0)), bool(formData, "isActive"), Number(s(formData, "sortOrder") || 0)];
    if (id) {
      await run(
        `update product_variants set name_th=$1, name_en=$2, price=$3, compare_at_price=$4,
           stock_quantity=$5, is_active=$6, sort_order=$7, updated_at=now() where id=$8 and product_id=$9`,
        [...values, id, productId],
      );
    } else {
      await run(
        `insert into product_variants(product_id,name_th,name_en,price,compare_at_price,stock_quantity,is_active,sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [productId, ...values],
      );
    }
    revalidatePath(`/admin/products/${productId}`);
    return { success: "Variant saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the variant." };
  }
}

export async function deleteVariantAction(variantId: string, productId: string): Promise<AdminResult> {
  try {
    await guard(PERMISSIONS.productsManage);
    const used = await one<{ count: number }>(
      "select count(*)::int as count from order_items where variant_id = $1",
      [variantId],
    );
    if (Number(used?.count ?? 0) > 0) return { error: "This variant has order history and cannot be deleted." };
    const inventory = await one<{ count: number }>(
      "select count(*)::int as count from product_inventory where variant_id = $1",
      [variantId],
    );
    if (Number(inventory?.count ?? 0) > 0) {
      return { error: "Move or remove this variant's inventory units first." };
    }
    await run("delete from product_variants where id = $1 and product_id = $2", [variantId, productId]);
    revalidatePath(`/admin/products/${productId}`);
    return { success: "Variant deleted." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not delete the variant." };
  }
}

export async function addInventoryAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.inventoryManage);
    const productId = s(formData, "productId");
    const variantId = nullable(formData, "variantId");
    const raw = s(formData, "items");
    if (!productId || !raw) return { error: "Product and at least one inventory item are required." };

    let entries: { username?: string; password?: string; email?: string; notes?: string; recovery?: string; [key: string]: string | undefined }[];
    try {
      const parsed = JSON.parse(raw);
      entries = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return { error: "Inventory must be valid JSON (object or array of objects)." };
    }
    if (entries.length === 0 || entries.length > 100) return { error: "Add between 1 and 100 items at a time." };

    await withTransaction(async (tx) => {
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") throw new Error("Each inventory entry must be an object.");
        const clean: Record<string, string> = {};
        for (const [key, value] of Object.entries(entry)) {
          if (typeof value !== "string" || value.length > 500) throw new Error("Inventory values must be strings under 500 characters.");
          clean[key.slice(0, 40)] = value;
        }
        if (Object.keys(clean).length === 0) throw new Error("Inventory entries cannot be empty.");
        await tx.query(
          `insert into product_inventory(product_id, variant_id, encrypted_payload, payload_hint)
           values ($1,$2::uuid,$3,$4)`,
          [
            productId,
            variantId,
            encryptSecret(JSON.stringify(clean)),
            (clean.username || clean.email || clean.code || "Item").slice(0, 60),
          ],
        );
      }
      await tx.query(
        `update products set stock_quantity = (
           select count(*)::int from product_inventory where product_id = $1 and status = 'AVAILABLE'
         ), updated_at = now() where id = $1 and stock_mode = 'inventory'`,
        [productId],
      );
    });
    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "inventory.add",
      entityType: "product",
      entityId: productId,
      after: { count: entries.length, variantId },
    });
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/products");
    return { success: `${entries.length} inventory item(s) added with encryption at rest.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add inventory." };
  }
}

export async function revealInventoryAction(inventoryId: string): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.inventoryReveal);
    const row = await one<{ encrypted_payload: string; status: string }>(
      "select encrypted_payload, status from product_inventory where id = $1",
      [inventoryId],
    );
    if (!row) return { error: "Inventory item not found." };
    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "inventory.reveal",
      entityType: "inventory",
      entityId: inventoryId,
      after: { status: row.status },
    });
    return { success: "Decrypted", data: JSON.parse(decryptSecret(row.encrypted_payload)) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not decrypt the item." };
  }
}

export async function deleteInventoryAction(inventoryId: string, productId: string): Promise<AdminResult> {
  try {
    await guard(PERMISSIONS.inventoryManage);
    const row = await one<{ status: string }>("select status from product_inventory where id = $1", [inventoryId]);
    if (!row) return { error: "Item not found." };
    if (row.status === "SOLD") return { error: "Sold inventory cannot be deleted." };
    await run("delete from product_inventory where id = $1", [inventoryId]);
    await run(
      `update products set stock_quantity = (
         select count(*)::int from product_inventory where product_id = $1 and status = 'AVAILABLE'
       ) where id = $1 and stock_mode = 'inventory'`,
      [productId],
    );
    revalidatePath(`/admin/products/${productId}`);
    return { success: "Inventory item deleted." };
  } catch (error) {
    return { error: "Could not delete the inventory item." };
  }
}

