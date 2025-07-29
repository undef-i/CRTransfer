TARGET_DIR = dist
WASM_DIR = src/wasm
TEMPLATES_DIR = src/templates
DATA_DIR = data

.PHONY: build clean

build:
	@echo "Building WASM package..."
	cd $(WASM_DIR) && ~/.cargo/bin/wasm-pack build --target web
	@echo "Creating target directory..."
	mkdir -p $(TARGET_DIR)
	@echo "Copying WASM package..."
	rsync -a --exclude=".*" $(WASM_DIR)/pkg $(TARGET_DIR)/
	@echo "Copying templates..."
	cp -r $(TEMPLATES_DIR)/* $(TARGET_DIR)/
	@echo "Copying data files..."
	cp -r $(DATA_DIR)/* $(TARGET_DIR)/
	@echo "Build completed successfully!"

clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(TARGET_DIR)
	rm -rf $(WASM_DIR)/pkg
	rm -rf $(WASM_DIR)/target
	@echo "Clean completed!"