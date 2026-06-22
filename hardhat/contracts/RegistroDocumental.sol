// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Registro Documental
/// @notice Contrato para el registro inmutable de documentos en blockchain
/// @dev Cada hash solo puede registrarse una vez. El emisor y timestamp quedan fijados permanentemente.
contract RegistroDocumental {

    struct Documento {
        address emisor;
        uint256 timestamp;
        bool existe;
    }

    mapping(bytes32 => Documento) public registro;

    event DocumentoRegistrado(
        bytes32 indexed hash,
        address indexed emisor,
        uint256 timestamp
    );

    /// @notice Registra un documento dado su hash
    /// @dev Falla si el documento ya fue registrado previamente
    /// @param _hash Hash SHA-256 del documento a registrar
    /// @custom:smtchecker abstract-function-nondet
    function registrar(bytes32 _hash) public {
        require(!registro[_hash].existe, "El documento ya esta registrado");

        registro[_hash] = Documento({
            emisor: msg.sender,
            timestamp: block.timestamp,
            existe: true
        });

        assert(registro[_hash].existe == true);
        assert(registro[_hash].emisor == msg.sender);
        assert(registro[_hash].timestamp > 0);

        emit DocumentoRegistrado(_hash, msg.sender, block.timestamp);
    }

    /// @notice Verifica si un documento está registrado
    /// @param _hash Hash del documento a verificar
    /// @return existe    Si el documento está registrado
    /// @return emisor    Dirección que lo registró
    /// @return timestamp Momento del registro
    function verificar(bytes32 _hash) public view returns (bool existe, address emisor, uint256 timestamp) {
        Documento memory doc = registro[_hash];
        return (doc.existe, doc.emisor, doc.timestamp);
    }
}