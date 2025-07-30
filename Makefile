TARGET_DIR = dist
WASM_DIR = src/wasm
TEMPLATES_DIR = src/templates
WASM_FILE_NAME = transit_bg.wasm

.PHONY: build clean

build:
	@echo "Building WASM package with path remapping..."
	(cd $(WASM_DIR) && RUSTFLAGS="--remap-path-prefix=$$HOME=~" wasm-pack build --target web --release)
	
	@echo "Creating target directory and copying files..."
	mkdir -p $(TARGET_DIR)
	
	@echo "Copying WASM package..."
	mkdir -p $(TARGET_DIR)/pkg
	cp -r $(WASM_DIR)/pkg/* $(TARGET_DIR)/pkg/
	
	@echo "Copying templates..."
	cp -r $(TEMPLATES_DIR)/* $(TARGET_DIR)/
	
	@echo "Stripping WASM file..."
	wasm-strip $(TARGET_DIR)/pkg/$(WASM_FILE_NAME)
	
	@echo "Build completed successfully!"

clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(TARGET_DIR)
	rm -rf $(WASM_DIR)/pkg
	rm -rf $(WASM_DIR)/target
	@echo "Clean completed!"