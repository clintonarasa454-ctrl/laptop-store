ALTER TABLE `users` MODIFY COLUMN `name` varchar(256);--> statement-breakpoint
ALTER TABLE `categories` ADD `parentId` int;--> statement-breakpoint
ALTER TABLE `categories` ADD `active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `cart_items` (`userId`);--> statement-breakpoint
CREATE INDEX `product_id_idx` ON `cart_items` (`productId`);--> statement-breakpoint
CREATE INDEX `active_idx` ON `categories` (`active`);--> statement-breakpoint
CREATE INDEX `order_id_idx` ON `order_items` (`orderId`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `orders` (`userId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `orders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `page_views` (`createdAt`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `brand_idx` ON `products` (`brand`);--> statement-breakpoint
CREATE INDEX `sku_idx` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `active_idx` ON `products` (`active`);--> statement-breakpoint
CREATE INDEX `category_id_idx` ON `products` (`categoryId`);--> statement-breakpoint
CREATE INDEX `product_id_idx` ON `reviews` (`productId`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `reviews` (`userId`);--> statement-breakpoint
CREATE INDEX `email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `users` (`name`);--> statement-breakpoint
CREATE INDEX `phone_idx` ON `users` (`phone`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `wishlists` (`userId`);--> statement-breakpoint
CREATE INDEX `product_id_idx` ON `wishlists` (`productId`);