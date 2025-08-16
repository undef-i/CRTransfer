TARGET_DIR = dist
WASM_DIR = src/wasm
DATA_DIR = data
STATIC_DIR = src/static
WASM_FILE_NAME = transit_bg.wasm

.PHONY: build clean sync

sync:
	@echo "Running sync tool..."
	rm -f data/ndt.json
	rm -f data/rdat.json
	rm -f data/scdat.json
	cd $(DATA_DIR) && ../src/sync/sync

build:
	@echo "Building WASM package with path remapping..."
	(cd $(WASM_DIR) && RUSTFLAGS="--remap-path-prefix=$$HOME=~" wasm-pack build --target web --release)
	
	@echo "Creating target directory and copying files..."
	mkdir -p $(TARGET_DIR)
	
	@echo "Copying WASM package..."
	mkdir -p $(TARGET_DIR)/pkg
	cp -r $(WASM_DIR)/pkg/* $(TARGET_DIR)/pkg/
	
	@echo "Copying static..."
	cp -r $(STATIC_DIR)/* $(TARGET_DIR)/
	
	@echo "Copying ndt.json"
	cp $(DATA_DIR)/ndt.json $(TARGET_DIR)/

	@echo "Stripping WASM file..."
	wasm-strip $(TARGET_DIR)/pkg/$(WASM_FILE_NAME)
	
	@echo "Build completed successfully!"

clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(TARGET_DIR)
	rm -rf $(WASM_DIR)/pkg
	rm -rf $(WASM_DIR)/target
	@echo "Clean completed!"